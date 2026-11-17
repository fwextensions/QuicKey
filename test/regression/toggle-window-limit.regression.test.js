// With "limit recents to the current window" on, switchTabs() handles a
// previous tab in another window by stepping data.previousTabIndex back and
// recursing.  ceb98fe gave toggle its own branch that always starts from the
// penultimate tab and never reads data.previousTabIndex, so the recursion
// picked the same tab forever and overflowed the stack.  That happened as soon
// as the user switched to another window and pressed toggle.
//
// navigate() also now resolves to whether it switched, so the toggle queue in
// commandHandlers doesn't wait for a tab activation that isn't coming.

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


	// entries are [id, windowId], oldest first, so the last one is the
	// current tab
function seedRecents(
	entries)
{
	const tabsByID = {};

	entries.forEach(([id, windowId], i) => {
		tabsByID[id] = { id, url: `https://${id}.example.com/`, windowId, lastVisit: 1000 + i };
	});

	store._seed({
		tabIDs: entries.map(([id]) => id),
		tabsByID,
		lastShortcutTime: 0,
		previousTabIndex: -1,
	});
}


beforeEach(async () => {
	vi.resetModules();
	recentTabs = (await import("@/background/recent-tabs")).default;
	chrome.windows.update = vi.fn(() => Promise.resolve());
	chrome.tabs.update = vi.fn(() => Promise.resolve());
});


describe("toggle limited to the current window", () => {
	it("skips tabs in other windows to the most recent one in this window", async () => {
			// window 1's older tab, then window 2's, then the current tab back
			// in window 1
		seedRecents([[1, 1], [2, 2], [3, 2], [4, 1]]);

		const switched = await recentTabs.toggle(true);

		expect(switched).toBe(true);
		expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(1, { active: true });
	});

	it("does nothing, without overflowing, when this window has no other recents", async () => {
			// the user just switched to window 2, whose only tab is the current one
		seedRecents([[1, 1], [2, 1], [3, 2]]);

		const switched = await recentTabs.toggle(true);

		expect(switched).toBe(false);
		expect(chrome.tabs.update).not.toHaveBeenCalled();
	});

	it("still toggles across windows when the limit is off", async () => {
		seedRecents([[1, 1], [2, 2]]);

		const switched = await recentTabs.toggle(false);

		expect(switched).toBe(true);
		expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(1, { active: true });
	});
});
