// Chrome restarted, the service worker woke before Chrome had restored any
// tabs, and onStartup's updateAll() ran against an empty chrome.tabs.query().
// Observed 2026-08-08 and 2026-08-10 in the persistent log:
//
//   updateAll: tabs.query took 124 ms for 0 tabs (retaining unmatched)
//   old recents: 50  fresh tabs: 0  matched: 0  missing: 50  retained: 50
//   onStartup: updateAll pass 1 took 2851 ms  missing: 50  pending: 0
//
// Every recent was retained under its pre-restart tab ID, so the list survived
// but pointed at tabs that no longer existed, and nothing ever retried the
// match -- onStartup doesn't fire again until the next Chrome restart, and it
// isn't wired to extension reload at all.  getAll() now notices that a startup
// happened with no successful rebuild since (lastStartupTime > lastUpdateTime)
// and rebuilds from the restored tabs.

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

	// getAll() deliberately doesn't await its internal storage.set(), so the
	// popup isn't blocked on the write
function settle()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}

	// the pre-restart recents: IDs from the dead session, URLs still valid
function seedStaleRecents(
	{ lastStartupTime, lastUpdateTime })
{
	store._seed({
		tabIDs: [775172655, 775172658],
		tabsByID: {
			775172655: { id: 775172655, url: "https://trmnl.com/flash", windowId: 900, lastVisit: 1786221758926 },
			775172658: { id: 775172658, url: "https://trmnl.com/dashboard", windowId: 900, lastVisit: 1786221758933 },
		},
		lastStartupTime,
		lastUpdateTime,
	});
}

	// the same pages, restored by Chrome under new tab IDs
const RestoredTabs = [
	{ id: 12, url: "https://trmnl.com/flash", windowId: 5 },
	{ id: 34, url: "https://trmnl.com/dashboard", windowId: 5 },
];


beforeEach(async () => {
	vi.resetModules();
	recentTabs = (await import("@/background/recent-tabs")).default;
});


describe("rematch after a startup that matched nothing", () => {
	it("rebuilds on the next getAll() when startup ran before any tabs existed", async () => {
			// startup wrote lastStartupTime, then matched nothing against an
			// empty query, so lastUpdateTime was left behind
		seedStaleRecents({ lastStartupTime: 2000, lastUpdateTime: 1000 });
		chrome.tabs.query = vi.fn(() => Promise.resolve(RestoredTabs));

		await recentTabs.getAll(false);
		await settle();

		const { tabIDs, tabsByID, lastUpdateTime } = store._dump();

			// the recents now point at the restored tabs...
		expect(tabIDs).toEqual([12, 34]);
			// ...carrying their original visit times, which is the whole point
		expect(tabsByID[12].lastVisit).toBe(1786221758926);
		expect(tabsByID[34].lastVisit).toBe(1786221758933);
			// and the rebuild records itself, so it won't run again
		expect(lastUpdateTime).toBeGreaterThan(2000);
	});

	it("doesn't rebuild in the steady state", async () => {
			// nothing owed, and the stored IDs are the live ones
		store._seed({
			tabIDs: [12, 34],
			tabsByID: {
				12: { id: 12, url: "https://trmnl.com/flash", windowId: 5, lastVisit: 100 },
				34: { id: 34, url: "https://trmnl.com/dashboard", windowId: 5, lastVisit: 200 },
			},
			lastStartupTime: 1000,
			lastUpdateTime: 2000,
		});
		chrome.tabs.query = vi.fn(() => Promise.resolve(RestoredTabs));

		await recentTabs.getAll(false);
		await settle();

			// reconciliation here is getAll()'s existing per-ID refresh, not a
			// full remap, so lastUpdateTime is untouched
		expect(store._dump().tabIDs).toEqual([12, 34]);
		expect(store._dump().lastUpdateTime).toBe(2000);
	});

		// the case that made the timestamp trigger useless in practice:
		// runtime.onStartup was seen not firing across days of restarts, so
		// nothing ever wrote lastStartupTime and 0 > 0 is false.  the recents
		// sat pointed at dead IDs with no path back.
	it("rebuilds on staleness when onStartup never fired", async () => {
		seedStaleRecents({ lastStartupTime: 0, lastUpdateTime: 0 });
		chrome.tabs.query = vi.fn(() => Promise.resolve(RestoredTabs));

		await recentTabs.getAll(false);
		await settle();

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([12, 34]);
			// carried across from the dead ID, which is the point of matching by
			// URL rather than starting over
		expect(tabsByID[12].lastVisit).toBe(1786221758926);
	});

		// a rebuild retains what it couldn't match, so a genuinely dead list
		// stays stale -- without the rate limit that would rebuild on every
		// single popup open
	it("doesn't rebuild on staleness again right away", async () => {
		seedStaleRecents({ lastStartupTime: 0, lastUpdateTime: Date.now() - 1000 });
		chrome.tabs.query = vi.fn(() => Promise.resolve(RestoredTabs));

		await recentTabs.getAll(false);
		await settle();

		expect(store._dump().tabIDs).toEqual([775172655, 775172658]);
	});

		// ordinary churn -- a couple of tabs closed -- must not look like a
		// dead session, or every popup open would remap the whole list
	it("doesn't treat ordinary churn as staleness", async () => {
		store._seed({
			tabIDs: [12, 34, 56],
			tabsByID: {
				12: { id: 12, url: "https://trmnl.com/flash", windowId: 5, lastVisit: 100 },
				34: { id: 34, url: "https://trmnl.com/dashboard", windowId: 5, lastVisit: 200 },
				56: { id: 56, url: "https://trmnl.com/gone", windowId: 5, lastVisit: 300 },
			},
			lastStartupTime: 0,
			lastUpdateTime: 0,
		});
		chrome.tabs.query = vi.fn(() => Promise.resolve(RestoredTabs));

		await recentTabs.getAll(false);
		await settle();

			// one of three gone is 33%, well under the threshold, so the list is
			// left alone rather than remapped
		expect(store._dump().tabIDs).toEqual([12, 34, 56]);
	});

		// the guard that keeps the fix from becoming a worse bug: if getAll()
		// runs while Chrome still hasn't restored anything, rebuilding would
		// drop every recent for good
	it("doesn't rebuild against an empty tab list", async () => {
		seedStaleRecents({ lastStartupTime: 2000, lastUpdateTime: 1000 });
		chrome.tabs.query = vi.fn(() => Promise.resolve([]));

		await recentTabs.getAll(false);
		await settle();

		const { tabIDs, lastUpdateTime } = store._dump();

		expect(tabIDs).toEqual([775172655, 775172658]);
			// and it stays flagged, so the next open tries again
		expect(lastUpdateTime).toBe(1000);
	});

		// the case a URL-less-tab check can't see: Chrome is part way through
		// restoring, so the tabs that haven't arrived yet are *absent* from the
		// query rather than present without a URL.  gating retention on
		// "some tab has no URL" reads this as "those recents are closed" and
		// drops them, permanently, while the tabs were still on their way.
	it("keeps unmatched recents when the restore is only part way through", async () => {
		seedStaleRecents({ lastStartupTime: 2000, lastUpdateTime: 1000 });
			// only the first page is back, and it has its URL -- so there is
			// nothing "pending" to notice
		chrome.tabs.query = vi.fn(() => Promise.resolve([
			{ id: 12, url: "https://trmnl.com/flash", windowId: 5 },
		]));

		await recentTabs.getAll(false);
		await settle();

		const { tabIDs, tabsByID } = store._dump();

			// the restored one is remapped to its new ID...
		expect(tabsByID[12]).toBeDefined();
			// ...and the one still being restored is kept, not dropped
		expect(tabsByID[775172658]).toBeDefined();
		expect(tabsByID[775172658].url).toBe("https://trmnl.com/dashboard");
		expect(tabIDs).toContain(775172658);
	});

	it("keeps unmatched recents while a tab is still loading", async () => {
		seedStaleRecents({ lastStartupTime: 2000, lastUpdateTime: 1000 });
			// the second page hasn't got its URL yet, so its recent can't be
			// matched -- but it isn't gone either
		chrome.tabs.query = vi.fn(() => Promise.resolve([
			{ id: 12, url: "https://trmnl.com/flash", windowId: 5 },
			{ id: 34, url: "", windowId: 5 },
		]));

		await recentTabs.getAll(false);
		await settle();

		const { tabsByID } = store._dump();

			// the matched one moved to its new ID, the unmatched one was kept
		expect(tabsByID[12]).toBeDefined();
		expect(tabsByID[775172658]).toBeDefined();
	});
});


describe("updateAll", () => {
	it("doesn't record a reconciliation it couldn't perform", async () => {
		seedStaleRecents({ lastStartupTime: 2000, lastUpdateTime: 1000 });
			// the empty query that started all this
		chrome.tabs.query = vi.fn(() => Promise.resolve([]));

		await recentTabs.updateAll(true);

		const { lastUpdateTime, lastStartupTime } = store._dump();

			// leaving lastUpdateTime behind is what lets getAll() retry
		expect(lastUpdateTime).toBe(1000);
		expect(lastStartupTime).toBe(2000);
	});

	it("records one it could", async () => {
		seedStaleRecents({ lastStartupTime: 2000, lastUpdateTime: 1000 });
		chrome.tabs.query = vi.fn(() => Promise.resolve(RestoredTabs));

		await recentTabs.updateAll(false);

		expect(store._dump().lastUpdateTime).toBeGreaterThan(2000);
	});
});
