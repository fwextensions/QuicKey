import { describe, it, expect, vi } from "vitest";

	// sw.js is the MV3 service worker entry: it registers temporary listeners
	// for every event the background cares about, caches anything that fires
	// while background.js is still initializing, and exposes
	// globalThis.dispatchCachedEvents() to replay the backlog once the real
	// handlers are wired up.  losing events during worker cold start is the
	// classic MV3 regression, so this pins the cache/replay contract.

	// sw.js pulls in background.js via importScripts(), which only exists in a
	// real worker; stub it so the module can load, and stub the install/activate
	// hooks it assigns.
vi.stubGlobal("importScripts", vi.fn());
vi.stubGlobal("skipWaiting", vi.fn());
vi.stubGlobal("clients", { claim: vi.fn() });

const CachedEventNames = [
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
	it("caches events fired before init and replays them, in order, to late listeners", async () => {
		await import("@/background/sw");

		expect(importScripts).toHaveBeenCalledWith("./background.js");
		expect(typeof globalThis.dispatchCachedEvents).toBe("function");

			// every cached event has exactly its one caching listener attached
		for (const name of CachedEventNames) {
			expect(getEvent(name).listenerCount(), name).toBe(1);
		}

			// events arrive while background.js would still be initializing
		chrome.tabs.onActivated.dispatch({ tabId: 7, windowId: 1 });
		chrome.commands.onCommand.dispatch("30-toggle-recent-tabs");
		chrome.tabs.onActivated.dispatch({ tabId: 8, windowId: 1 });

			// the real handlers show up late, the way background.js wires them
			// up at the end of its startup chain
		const replayed = [];

		chrome.tabs.onActivated.addListener(({ tabId }) => replayed.push(["activated", tabId]));
		chrome.commands.onCommand.addListener((command) => replayed.push(["command", command]));

		globalThis.dispatchCachedEvents();

			// the backlog is replayed in arrival order, interleaved across events
		expect(replayed).toEqual([
			["activated", 7],
			["command", "30-toggle-recent-tabs"],
			["activated", 8],
		]);

			// the caching listeners detached themselves, so only the real
			// handlers remain and a new event is neither cached nor doubled
		expect(chrome.tabs.onActivated.listenerCount()).toBe(1);

		chrome.tabs.onActivated.dispatch({ tabId: 9, windowId: 1 });

		expect(replayed.at(-1)).toEqual(["activated", 9]);
	});
});
