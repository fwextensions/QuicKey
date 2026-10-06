import { describe, it, expect, vi } from "vitest";

	// sw.js is the MV3 service worker entry: it registers temporary listeners
	// for every event the background cares about, caches anything that fires
	// while background.js is still loading, and replays the backlog once
	// background.js says its real handlers are wired up.  losing events during
	// worker cold start is the classic MV3 regression, so this pins the
	// cache/replay contract.

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


describe("sw.js event caching", () => {
	it("keeps caching after the import returns, until background.js says it's loaded", async () => {
		const replayed = [];
		const now = Date.now();
		let finishLoading;

			// stand in for background.js, which is bundled in an async iife:
			// the import returns at its first top-level await, and the real
			// handlers are only registered after that resolves
		importScripts.mockImplementation(() => {
			for (const name of CachedEventNames) {
				expect(getEvent(name).listenerCount(), name).toBe(1);
			}

			finishLoading = () => {
				chrome.tabs.onActivated.addListener(({ tabId }) => replayed.push(["activated", tabId]));
				chrome.commands.onCommand.addListener((command) => replayed.push(["command", command]));
				globalThis.backgroundLoaded();
			};
		});

		await import("@/background/sw");

		expect(importScripts).toHaveBeenCalledWith("./background.js");

			// events arriving after the import returned, but before the real
			// listeners exist, including the shortcut that woke the worker.
			// one of them is long stale.
		vi.spyOn(Date, "now").mockReturnValue(now - 60 * 1000);
		chrome.commands.onCommand.dispatch("stale-command");
		Date.now.mockReturnValue(now);

		chrome.tabs.onActivated.dispatch({ tabId: 7, windowId: 1 });
		chrome.commands.onCommand.dispatch("2-open-popup-window");
		chrome.tabs.onActivated.dispatch({ tabId: 8, windowId: 1 });

			// the onCommand placeholder is still there to catch them
		expect(chrome.commands.onCommand.listenerCount()).toBe(1);
		expect(replayed).toEqual([]);

		finishLoading();
		Date.now.mockRestore();

			// the backlog is replayed once background.js is loaded, in arrival
			// order, interleaved across events, minus the stale command
		expect(replayed).toEqual([
			["activated", 7],
			["command", "2-open-popup-window"],
			["activated", 8],
		]);

			// the placeholders stay attached, so Chrome keeps each event's
			// wake-up registration, but a new event is neither cached nor
			// doubled
		expect(chrome.tabs.onActivated.listenerCount()).toBe(2);

		chrome.tabs.onActivated.dispatch({ tabId: 9, windowId: 1 });

		expect(replayed.slice(3)).toEqual([["activated", 9]]);

			// except onCommand's, which has to go so the toolbar menu can get
			// the shortcut keys while it's open
		expect(chrome.commands.onCommand.listenerCount()).toBe(1);

			// a second call doesn't replay anything again
		globalThis.backgroundLoaded();

		expect(replayed.length).toBe(4);
	});
});
