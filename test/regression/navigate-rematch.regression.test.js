// After a restart, every stored tab ID is dead.  switchTabs() handled a dead ID
// by deleting it and recursing, which is right when the user closed one tab
// behind our back and useless when the whole list is from a previous session:
// a single alt-A walked all 50 entries, deleted every one, and switched to
// nothing.  The tabs were still open under new IDs, so a URL rematch would have
// recovered them -- which is what getAll() does on the popup path, but
// navigate() never goes through getAll().
//
// It can't call getAll() either: switchTabs() runs inside
// storage.set(switchTabs, "navigate"), so it already holds the storage lock,
// and getAll() asks for the same lock through storage.get().  Web locks aren't
// reentrant, so that deadlocks.  The matching needs no lock, so it happens
// inline instead.

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

	// the pre-restart recents: five entries, all pointing at dead IDs
const DeadIDs = [901, 902, 903, 904, 905];
const URLs = [
	"https://one.example.com/",
	"https://two.example.com/",
	"https://three.example.com/",
	"https://four.example.com/",
	"https://five.example.com/",
];
	// the same five pages, restored under new IDs
const RestoredTabs = URLs.map((url, i) => ({ id: 11 + i, url, windowId: 5 }));


function seedDeadRecents()
{
	const tabsByID = {};

	DeadIDs.forEach((id, i) => {
		tabsByID[id] = { id, url: URLs[i], windowId: 900, lastVisit: 1000 + i };
	});

	store._seed({
		tabIDs: [...DeadIDs],
		tabsByID,
		lastShortcutTime: 0,
		previousTabIndex: -1,
		lastStartupTime: 0,
		lastUpdateTime: 0,
	});
}


beforeEach(async () => {
	vi.resetModules();
	recentTabs = (await import("@/background/recent-tabs")).default;

		// the dead IDs fail and the restored ones work, so a rematch is what
		// makes navigation start succeeding again
	chrome.windows.update = vi.fn((windowId) => windowId === 900
		? Promise.reject(new Error("No window with id"))
		: Promise.resolve());
	chrome.tabs.update = vi.fn((tabId) => DeadIDs.includes(tabId)
		? Promise.reject(new Error("No tab with id"))
		: Promise.resolve());
	chrome.tabs.query = vi.fn(() => Promise.resolve(RestoredTabs));
});


describe("navigating a list of dead tab IDs", () => {
	it("rematches instead of deleting the whole list", async () => {
		seedDeadRecents();

		await recentTabs.navigate(-1);

		const { tabIDs } = store._dump();

			// the recents survived, remapped onto the restored tabs, rather than
			// being deleted one at a time down to nothing
		expect(tabIDs.length).toBe(DeadIDs.length);
		expect(tabIDs.every((id) => id < 100)).toBe(true);
	});

	it("looks at the live tabs only once", async () => {
		seedDeadRecents();

		await recentTabs.navigate(-1);

			// tabs.query() costs seconds on a big profile, so a keypress must
			// not turn into one call per dead entry
		expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
	});

		// the expensive path has to stay off the common case: one tab closed
		// behind our back is not a dead session
	it("doesn't rematch for a single missing tab", async () => {
		const liveTabs = RestoredTabs.slice(0, 2);
		const tabsByID = {};

		liveTabs.forEach(({id, url, windowId}, i) => {
			tabsByID[id] = { id, url, windowId, lastVisit: 1000 + i };
		});

			// one dead entry at the end of an otherwise live list
		tabsByID[999] = { id: 999, url: "https://gone.example.com/", windowId: 5, lastVisit: 900 };

		store._seed({
			tabIDs: [999, ...liveTabs.map(({id}) => id)],
			tabsByID,
			lastShortcutTime: 0,
			previousTabIndex: -1,
			lastStartupTime: 0,
			lastUpdateTime: 0,
		});

		chrome.windows.update = vi.fn((windowId) => windowId === 900
			? Promise.reject(new Error("No window with id"))
			: Promise.resolve());
		chrome.tabs.update = vi.fn(() => Promise.resolve());

		await recentTabs.navigate(-1);

		expect(chrome.tabs.query).not.toHaveBeenCalled();
	});

		// an empty query means the browser isn't ready, not that the tabs are
		// gone -- the same invariant getAll() and updateAll() follow
	it("doesn't wipe the list when the browser reports no tabs", async () => {
		seedDeadRecents();
		chrome.tabs.query = vi.fn(() => Promise.resolve([]));

		await recentTabs.navigate(-1);

		expect(store._dump().tabIDs.length).toBeGreaterThan(0);
	});
});
