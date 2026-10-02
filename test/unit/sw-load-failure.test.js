import { describe, it, expect, vi } from "vitest";

	// sw.js is the MV3 service worker entry: it registers temporary listeners
	// for every event the background cares about, caches anything that fires
	// while background.js is still loading, and replays the backlog as soon
	// as the import returns and the real handlers are wired up.  losing events during worker cold start is the
	// classic MV3 regression, so this pins the cache/replay contract.

	// sw.js pulls in background.js via importScripts(), which only exists in a
	// real worker; stub it so the module can load, and stub the install/activate
	// hooks it assigns.
vi.stubGlobal("importScripts", vi.fn());
vi.stubGlobal("skipWaiting", vi.fn());
vi.stubGlobal("clients", { claim: vi.fn() });

const CachedEventNames = [
	"alarms.onAlarm",
	"commands.onCommand",
	"runtime.onConnect",
	"runtime.onInstalled",
	"runtime.onMessage",
	"runtime.onStartup",
	"runtime.onUpdateAvailable",
	"tabs.onActivated",
	"tabs.onCreated",
	"tabs.onRemoved",
	"tabs.onReplaced",
	"windows.onFocusChanged",
];

const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);


describe("sw.js when background.js fails to load", () => {
	it("keeps every placeholder listener, so the events can still wake a new worker", async () => {
		importScripts.mockImplementation(() => {
			chrome.tabs.onActivated.dispatch({ tabId: 7, windowId: 1 });

			throw new SyntaxError("Unexpected token");
		});
		vi.spyOn(console, "error").mockImplementation(() => {});

		await import("@/background/sw");

			// removing these would leave no listener, and Chrome would drop the
			// registration that starts the worker for the event
		for (const name of CachedEventNames) {
			expect(getEvent(name).listenerCount(), name).toBe(1);
		}

			// and with no real handlers, nothing is replayed or cached
		chrome.tabs.onActivated.dispatch({ tabId: 8, windowId: 1 });
		expect(console.error).toHaveBeenCalledTimes(1);
	});
});
