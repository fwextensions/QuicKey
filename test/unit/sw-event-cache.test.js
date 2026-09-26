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


describe("sw.js event caching", () => {
	it("replays events cached while background.js loads, then stops caching", async () => {
		const replayed = [];
		const now = Date.now();

			// stand in for background.js: events arrive while it's still being
			// evaluated, one of them long ago, and it registers the real
			// handlers before it returns
		importScripts.mockImplementation(() => {
			for (const name of CachedEventNames) {
				expect(getEvent(name).listenerCount(), name).toBe(1);
			}

			vi.spyOn(Date, "now").mockReturnValue(now - 60 * 1000);
			chrome.commands.onCommand.dispatch("stale-command");
			Date.now.mockReturnValue(now);

			chrome.tabs.onActivated.dispatch({ tabId: 7, windowId: 1 });
			chrome.commands.onCommand.dispatch("30-toggle-recent-tabs");
			chrome.tabs.onActivated.dispatch({ tabId: 8, windowId: 1 });

			chrome.tabs.onActivated.addListener(({ tabId }) => replayed.push(["activated", tabId]));
			chrome.commands.onCommand.addListener((command) => replayed.push(["command", command]));
		});

		await import("@/background/sw");
		Date.now.mockRestore();

		expect(importScripts).toHaveBeenCalledWith("./background.js");

			// the backlog is replayed right after the import, in arrival order,
			// interleaved across events, minus the stale command
		expect(replayed).toEqual([
			["activated", 7],
			["command", "30-toggle-recent-tabs"],
			["activated", 8],
		]);

			// the caching listeners detached themselves, so only the real
			// handlers remain and a new event is neither cached nor doubled
		expect(chrome.tabs.onActivated.listenerCount()).toBe(1);

		chrome.tabs.onActivated.dispatch({ tabId: 9, windowId: 1 });

		expect(replayed.slice(3)).toEqual([["activated", 9]]);
	});
});
