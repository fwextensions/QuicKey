import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ga4mp from "@/lib/ga4mp";

	// the menu ends its popup-session and calls window.close() in the same
	// tick.  ga4mp used to await a fresh getHighEntropyValues() before sending
	// every event, so the page was gone before the beacon went out, and GA lost
	// most of the menu's popup-session events.  now the hints are looked up once
	// when the tracker is created, and events after that are sent synchronously.

const Hints = {
	architecture: "x86",
	bitness: "64",
	fullVersionList: [{ brand: "Google Chrome", version: "157.0.7400.1" }],
	mobile: false,
	model: "",
	platform: "Windows",
	platformVersion: "19.0.0",
	wow64: false,
};

let sendBeacon;
let resolveHints;
let rejectHints;
let originalNavigator;

function stubNavigator(
	getHighEntropyValues)
{
	vi.stubGlobal("navigator", {
		...originalNavigator,
		language: "en-US",
		sendBeacon,
		userAgentData: {
			brands: [],
			mobile: false,
			platform: "Windows",
			getHighEntropyValues,
		},
	});
}

function createTracker()
{
	return ga4mp(["G-TEST"], { client_id: "client-1", non_personalized_ads: true });
}

function sentParams(
	call = sendBeacon.mock.lastCall)
{
	return new URL(call[0]).searchParams;
}

beforeEach(() => {
		// ga4mp picks node mode when it sees `process`, which Vitest has and
		// the extension doesn't.  a window with a document makes it take the
		// browser path, as it does in the popup page.
	globalThis.window = { document: {} };
	originalNavigator ??= globalThis.navigator;
	sendBeacon = vi.fn(() => true);
	stubNavigator(() => new Promise((resolve, reject) => {
		resolveHints = resolve;
		rejectHints = reject;
	}));
});

afterEach(() => {
	vi.stubGlobal("navigator", originalNavigator);
	delete globalThis.window;
});


describe("ga4mp trackEvent", () => {
	it("sends synchronously once the client hints are in", async () => {
		const tracker = createTracker();

		resolveHints(Hints);
			// let the lookup's promise chain settle
		await new Promise((resolve) => setTimeout(resolve, 0));

		tracker.trackEvent("popup-session", { ms: 1200 });

			// no await between the call and this check: a page closing right
			// after trackEvent() would still have sent it
		expect(sendBeacon).toHaveBeenCalledTimes(1);
		expect(sentParams().get("en")).toBe("popup-session");
		expect(sentParams().get("uap")).toBe("Windows");
	});

	it("only looks up the client hints once", async () => {
		const getHighEntropyValues = vi.fn(() => Promise.resolve(Hints));

		stubNavigator(getHighEntropyValues);

		const tracker = createTracker();

		await new Promise((resolve) => setTimeout(resolve, 0));
		tracker.trackEvent("a");
		tracker.trackEvent("b");
		tracker.trackEvent("c");

		await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(3));
		expect(getHighEntropyValues).toHaveBeenCalledTimes(1);
	});

	it("holds events sent before the hints arrive, then sends them with the hints", async () => {
		const tracker = createTracker();

		tracker.trackEvent("background-loaded");
		expect(sendBeacon).not.toHaveBeenCalled();

		resolveHints(Hints);

		await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1));
		expect(sentParams().get("en")).toBe("background-loaded");
		expect(sentParams().get("uap")).toBe("Windows");
	});

	it("still sends when the client hints are refused", async () => {
		const tracker = createTracker();

		tracker.trackEvent("install");
		rejectHints(new Error("NotAllowedError"));

		await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1));
		expect(sentParams().get("en")).toBe("install");
		expect(sentParams().has("uap")).toBe(false);

			// and later events don't wait for anything
		tracker.trackEvent("toggle-shortcut");
		expect(sendBeacon).toHaveBeenCalledTimes(2);
	});
});
