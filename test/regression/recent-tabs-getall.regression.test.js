// Documents a bug fixed by PR #139 — expected to FAIL on dev, passes once merged.

import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = vi.hoisted(() => {
	const clone = (v) => structuredClone(v);
	let data = {};

	async function doTask(task, save) {
		const current = clone(data);
		const result = await task(current);

		if (save && result) {
			data = { ...current, ...result };
		}

		return result;
	}

	return {
		default: {
			get: (task = (d) => d) => doTask(task, false),
			set: (task) => doTask(task, true),
			reset: () => { data = {}; return Promise.resolve(); },
			_seed: (v) => { data = clone(v); },
			_dump: () => clone(data),
		},
	};
});

vi.mock("@/background/quickey-storage", () => storage);

const store = storage.default;
let recentTabs;


beforeEach(async () => {
	recentTabs = (await import("@/background/recent-tabs")).default;
	store._seed({
		tabIDs: [1, 2],
		tabsByID: {
			1: { id: 1, url: "https://stale.example.com/", windowId: 1, lastVisit: 100 },
			2: { id: 2, url: "https://other.example.com/", windowId: 1, lastVisit: 200 },
		},
	});
});


it("persists a tab's refreshed URL into storage after getAll() re-matches it by id", async () => {
	chrome.tabs.query = vi.fn(() => Promise.resolve([
		{ id: 1, url: "https://fresh.example.com/", windowId: 1 },
		{ id: 2, url: "https://other.example.com/", windowId: 1 },
	]));

	await recentTabs.getAll(false);

		// getAll() doesn't await its internal storage.set(), so give it a
		// chance to settle before inspecting the store
	await new Promise((resolve) => setTimeout(resolve, 0));

		// on dev, getAll() calls storage.set(() => { tabsByID }), whose arrow
		// body is a block statement (not an object literal), so it returns
		// undefined and the storage layer's "falsy result saves nothing" rule
		// silently drops this update
	expect(store._dump().tabsByID[1].url).toBe("https://fresh.example.com/");
});
