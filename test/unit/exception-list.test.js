import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createExceptionList, parseStackFrames } from "@/lib/exception-list";

	// what PostHog's error tracking gets from tracker.exception().  it names
	// issues after the exception type and fingerprints them on the in-app
	// stack frames, so these decide whether the same bug lands in one issue.

const Origin = "chrome-extension://abcdefghijklmnop";
const Stack = [
	"TypeError: Cannot read properties of undefined (reading 'id')",
	`    at getTab (${Origin}/js/background.js:120:15)`,
	"    at Array.map (<anonymous>)",
	`    at async handleMessage (${Origin}/js/background.js:300:7)`,
	`    at ${Origin}/js/background.js:5:1`,
].join("\n");


beforeEach(() => {
	vi.stubGlobal("location", { origin: Origin });
});

afterEach(() => {
	vi.unstubAllGlobals();
});


describe("parseStackFrames", () => {
	it("lists frames outermost first, with the throwing frame last", () => {
		const frames = parseStackFrames(Stack);

		expect(frames.map(frame => frame.function))
			.toEqual(["?", "handleMessage", "Array.map", "getTab"]);
		expect(frames.at(-1)).toEqual({
			platform: "web:javascript",
			filename: "js/background.js",
			function: "getTab",
			lineno: 120,
			colno: 15,
			in_app: true
		});
	});

	it("strips the extension origin so frames match across extension IDs", () => {
		const filenames = parseStackFrames(Stack).map(frame => frame.filename);

		expect(filenames).not.toContain(expect.stringContaining("chrome-extension"));
	});

	it("marks only our own frames as in-app", () => {
		const frames = parseStackFrames(Stack);
		const native = frames.find(frame => frame.function === "Array.map");

		expect(native).toEqual({
			platform: "web:javascript",
			filename: "<anonymous>",
			function: "Array.map",
			in_app: false
		});
		expect(frames.filter(frame => frame.in_app)).toHaveLength(3);
	});

	it("treats code run from the devtools console as not in-app", () => {
		const [frame] = parseStackFrames("Error: test\n    at <anonymous>:1:26");

		expect(frame).toMatchObject({ filename: "<anonymous>", lineno: 1, colno: 26, in_app: false });
	});
});


describe("createExceptionList", () => {
	it("uses an error's real type, message and frames", () => {
		const error = new TypeError("boom");

		error.stack = Stack;

		const [exception] = createExceptionList(error, { handled: false });

		expect(exception.type).toBe("TypeError");
		expect(exception.value).toBe("boom");
		expect(exception.mechanism).toEqual({ handled: false, synthetic: false });
		expect(exception.stacktrace.type).toBe("raw");
		expect(exception.stacktrace.frames).toHaveLength(4);
	});

	it("pulls the type and message out of a stringified stack", () => {
		const [exception] = createExceptionList(Stack);

		expect(exception.type).toBe("TypeError");
		expect(exception.value).toBe("Cannot read properties of undefined (reading 'id')");
		expect(exception.stacktrace.frames).toHaveLength(4);
		expect(exception.mechanism.handled).toBe(true);
	});

	it("reports a plain message without a stacktrace", () => {
		const [exception] = createExceptionList("No tab with id: 3");

		expect(exception).toEqual({
			type: "Error",
			value: "No tab with id: 3",
			mechanism: { handled: true, synthetic: false }
		});
	});

	it("uses the location on an error event that has no error object", () => {
		const [exception] = createExceptionList({
			message: "Script error",
			filename: `${Origin}/js/popup.js`,
			lineno: 10,
			colno: 2
		});

		expect(exception.value).toBe("Script error");
		expect(exception.stacktrace.frames).toEqual([{
			platform: "web:javascript",
			filename: "js/popup.js",
			function: "?",
			lineno: 10,
			colno: 2,
			in_app: true
		}]);
	});

	it("handles a missing or odd error without throwing", () => {
		expect(createExceptionList(undefined)[0].value).toBe("Generic error");
		expect(createExceptionList(42)[0].value).toBe("42");
		expect(createExceptionList({})[0].value).toBe("");
	});
});
