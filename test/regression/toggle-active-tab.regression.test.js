// On a cold start, the toggle shortcut's active tab often isn't the most
// recent one yet, since the replayed focus change hasn't added it.  The toggle
// used to add it with a separate storage task before navigate()'s own, which
// cost a second read and write of the whole recents list, the slowest part
// of a cold-start toggle.  toggle() now takes the active tab and adds it in
// the same task as the switch.

import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = vi.hoisted(() => {
	const clone = (v) => structuredClone(v);
	let data = {};
	let setCount = 0;

	async function doTask(task, save) {
		const current = clone(data);
		const result = await task(current);

		if (save && result) {
			setCount++;
			data = { ...current, ...result };
		}

		return result;
	}

	return {
		default: {
			get: (task = (d) => d) => doTask(task, false),
			set: (task) => doTask(task, true),
			reset: () => { data = {}; setCount = 0; return Promise.resolve(); },
			_seed: (v) => { data = clone(v); setCount = 0; },
			_dump: () => clone(data),
			_setCount: () => setCount,
		},
	};
});

vi.mock("@/background/quickey-storage", () => storage);

const store = storage.default;
let recentTabs;


const makeTab = (id, windowId) => ({ id, url: `https://${id}.example.com/`, windowId });


	// entries are [id, windowId], oldest first, so the last one is the
	// current tab
function seedRecents(
	entries)
{
	const tabsByID = {};

	entries.forEach(([id, windowId], i) => {
		tabsByID[id] = { ...makeTab(id, windowId), lastVisit: 1000 + i };
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


describe("toggle with the shortcut's active tab", () => {
	it("toggles to the newest recent when the active tab isn't on top yet", async () => {
			// the user was on 3 in window 2, then clicked back into window 1,
			// whose tab 2 hasn't been added yet
		seedRecents([[1, 1], [2, 1], [3, 2]]);

		const switched = await recentTabs.toggle(false, makeTab(2, 1));

		expect(switched).toBe(true);
		expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(3, { active: true });
		expect(store._dump().tabIDs).toEqual([1, 3, 2]);
		expect(store._setCount()).toBe(1);
	});

	it("adds an active tab that isn't in the recents at all", async () => {
		seedRecents([[1, 1], [2, 1]]);

		const switched = await recentTabs.toggle(false, makeTab(5, 1));

		expect(switched).toBe(true);
		expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(2, { active: true });
		expect(store._dump().tabIDs).toEqual([1, 2, 5]);
		expect(store._dump().tabsByID[5]).toMatchObject(makeTab(5, 1));
	});

	it("toggles normally when the active tab is already on top", async () => {
		seedRecents([[1, 1], [2, 1]]);

		const switched = await recentTabs.toggle(false, makeTab(2, 1));

		expect(switched).toBe(true);
		expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(1, { active: true });
		expect(store._dump().tabIDs).toEqual([1, 2]);
	});

	it("still records the active tab when there's nowhere to toggle to", async () => {
			// limited to window 2, which has no other recents
		seedRecents([[1, 1], [2, 2], [3, 1]]);

		const switched = await recentTabs.toggle(true, makeTab(2, 2));

		expect(switched).toBe(false);
		expect(chrome.tabs.update).not.toHaveBeenCalled();
		expect(store._dump().tabIDs).toEqual([1, 3, 2]);
	});

	it("limits to the active tab's window, not the stale top tab's", async () => {
		seedRecents([[1, 1], [2, 2], [3, 1], [4, 2]]);

		const switched = await recentTabs.toggle(true, makeTab(3, 1));

		expect(switched).toBe(true);
		expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(1, { active: true });
	});

	it("ignores the extension's own popup", async () => {
		seedRecents([[1, 1], [2, 1]]);

		const { PopupURL } = await import("@/background/constants");
		const popupTab = { id: 9, url: PopupURL, windowId: 3 };
		const switched = await recentTabs.toggle(false, popupTab);

		expect(switched).toBe(true);
		expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(1, { active: true });
		expect(store._dump().tabIDs).toEqual([1, 2]);
	});
});
