import { describe, it, expect, beforeEach, vi } from "vitest";

	// what reaches GA from tracker.exception().  the description is the only
	// thing distinguishing one report from another there, and GA buckets
	// everything past 500 distinct values into "(other)", so errors we can't act
	// on don't just cost quota -- they push the ones we can act on out of the
	// report entirely.

const ga4 = vi.hoisted(() => ({
	trackEvent: vi.fn(),
	setEventsParameter: vi.fn(),
}));

vi.mock("@/lib/ga4mp", () => ({ default: () => ga4 }));

const Tracker = (await import("@/background/tracker")).default;

let tracker;


	// the description of every exception event that made it through
function sentDescriptions()
{
	return ga4.trackEvent.mock.calls
		.filter(([event]) => event === "exception")
		.map(([, params]) => params.description);
}


beforeEach(() => {
	vi.clearAllMocks();
	tracker = new Tracker({ id: "G-TEST", sendPageview: false });
});


describe("tracker.exception() filtering", () => {
	it.each([
		["a full disk",
			"Error: IO error: .../001053.ldb: FILE_ERROR_NO_SPACE (ChromeMethodBFE: 3)"],
		["a tab that's already gone",
			"Error: No tab with id: 211632806."],
		["a tab being dragged",
			"Error: Tabs cannot be edited right now (user may be dragging a tab)."],
	])("doesn't report %s", (label, message) => {
		tracker.exception(message);

		expect(sentDescriptions()).toEqual([]);
	});

		// these arrive buried in a stack or an unhandled-rejection wrapper as
		// often as they do on their own
	it("matches an ignored error inside a larger stack", () => {
		tracker.exception(
			"Caught unhandled promise rejection:\nError: No tab with id: 42.\n    at add (background.js:1:1)");

		expect(sentDescriptions()).toEqual([]);
	});

	it("filters an Error object the same as a string", () => {
		const error = new Error("Tabs cannot be edited right now (user may be dragging a tab).");

		error.stack = `Error: ${error.message}\n    at toggle (background.js:1:1)`;

		tracker.exception(error);

		expect(sentDescriptions()).toEqual([]);
	});

		// the noisiest message of all, kept on purpose: coalescing the badge
		// writes should have cut it down, and filtering it now would hide
		// whether that worked
	it("still reports the browser shutting down", () => {
		tracker.exception("Error: The browser is shutting down.");

		expect(sentDescriptions()).toEqual(["Error: The browser is shutting down."]);
	});

	it("reports an ordinary error", () => {
		tracker.exception("TypeError: Cannot read properties of undefined");

		expect(sentDescriptions()).toEqual(["TypeError: Cannot read properties of undefined"]);
	});

	it("reports a missing error as a generic one", () => {
		tracker.exception();

		expect(sentDescriptions()).toEqual(["Generic error"]);
	});

	it("passes the fatal flag through", () => {
		tracker.exception("TypeError: boom", true);

		const [, params] = ga4.trackEvent.mock.calls.at(-1);

		expect(params.fatal).toBe(true);
	});

		// an error object with neither stack nor message leaves description
		// undefined, which the filter must not throw on
	it("doesn't throw on an error it can't describe", () => {
		expect(() => tracker.exception({})).not.toThrow();
	});
});
