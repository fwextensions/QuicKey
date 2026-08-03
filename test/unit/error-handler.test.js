import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import trackers from "@/background/page-trackers";

	// what the global error/unhandledrejection handlers send to GA.  the
	// description is the only thing that distinguishes one report from another
	// there, and it lands in a field that's truncated well before a full stack
	// fits, so what goes into it -- and what stays out of it -- matters.

let handlers;
let exception;


	// error-handler registers on the global addEventListener, which the node
	// test environment doesn't have, so capture the listeners instead
function loadHandler()
{
	handlers = {};

	vi.stubGlobal("addEventListener", (type, fn) => (handlers[type] = fn));

	return import("@/lib/error-handler");
}

function reject(
	reason)
{
	return handlers.unhandledrejection({
		type: "unhandledrejection",
		reason,
		preventDefault: vi.fn(),
	});
}


beforeEach(async () => {
	vi.resetModules();
	exception = vi.spyOn(trackers.background, "exception");

	await loadHandler();
});

afterEach(() => {
		// no unstubAllGlobals() here: setup.js installs chrome/navigator/
		// location as stubs too, and clearing them would break the modules that
		// read them at import time.  loadHandler() re-stubs addEventListener
		// for each test anyway.
	vi.restoreAllMocks();
});


describe("error handler reporting", () => {
		// the timestamp used to be part of the message, so the same error hit
		// by two users -- or twice by one -- never aggregated into a single row
	it("sends the same description for the same error every time", async () => {
		const makeError = () => {
			const error = new Error("boom");

			error.stack = "Error: boom\n    at doThing (background.js:1:1)";

			return error;
		};

		await reject(makeError());
		await reject(makeError());

		const [first] = exception.mock.calls[0];
		const [second] = exception.mock.calls[1];

		expect(exception).toHaveBeenCalledTimes(2);
		expect(first).toBe(second);
		expect(first).not.toMatch(/\d{1,2}:\d{2}/);
	});

	it("reports the stack, with the extension URL stripped", async () => {
		const error = new Error("boom");

		error.stack = "Error: boom\n    at doThing (chrome-extension://abc123/js/background.js:1:1)";

		await reject(error);

		const [description] = exception.mock.calls[0];

		expect(description).toContain("Error: boom");
		expect(description).toContain("promise rejection");
			// the whole chrome-extension:// path is stripped, not just the
			// origin, leaving the bare filename and line
		expect(description).toContain("at doThing (background.js:1:1)");
		expect(description).not.toContain("chrome-extension://");
	});

	it("marks the report fatal, which is how GA tells these from caught errors", async () => {
		await reject(new Error("boom"));

		expect(exception.mock.calls[0][1]).toBe(true);
	});

		// a promise rejected with a string has no stack at all, and the
		// description would otherwise be nothing but the boilerplate prefix
	it("falls back to the reason when there's no stack", async () => {
		await reject("something went sideways");

		expect(exception.mock.calls[0][0]).toContain("something went sideways");
	});

	it("distinguishes a thrown exception from a rejected promise", async () => {
		const error = new Error("boom");

		error.stack = "Error: boom\n    at doThing (background.js:1:1)";

		await handlers.error({
			type: "error",
			error,
			preventDefault: vi.fn(),
		});

		expect(exception.mock.calls[0][0]).toContain("exception");
		expect(exception.mock.calls[0][0]).not.toContain("promise rejection");
	});

		// the devtools console triggers these while you type
	it("ignores an event that's already been defaultPrevented", async () => {
		await handlers.error({
			type: "error",
			defaultPrevented: true,
			error: new Error("boom"),
		});

		expect(exception).not.toHaveBeenCalled();
	});
});
