import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

	// a faithful get/set stand-in for the quickey-storage singleton, mirroring
	// the real merge-and-save rule: a task returning a falsy/undefined value
	// saves nothing.  this exact pattern is the proven way to test recent-tabs
	// deterministically, since vi.mock() factories are hoisted above imports.
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


function tab(
	id,
	url,
	windowId = 1)
{
	return { id, url, windowId };
}


beforeEach(async () => {
	recentTabs = (await import("@/background/recent-tabs")).default;
	store._seed({ tabIDs: [], tabsByID: {} });
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2024, 0, 1));
});

afterEach(() => {
	vi.useRealTimers();
});


describe("recent-tabs add()", () => {
	it("pushes a new tab onto the end of tabIDs and records it with a lastVisit", async () => {
		await recentTabs.add(tab(1, "https://a.example.com/"));

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([1]);
		expect(tabsByID[1]).toMatchObject({ id: 1, url: "https://a.example.com/", windowId: 1 });
		expect(tabsByID[1].lastVisit).toBeGreaterThan(0);
	});

	it("refreshes lastVisit instead of duplicating when the same last tab is re-added", async () => {
		const t = tab(1, "https://a.example.com/");

		await recentTabs.add(t);
		const firstVisit = store._dump().tabsByID[1].lastVisit;

		vi.advanceTimersByTime(1000);
		await recentTabs.add(t);

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([1]);
		expect(tabsByID[1].lastVisit).toBeGreaterThan(firstVisit);
	});

	it("add(tab, true) inserts penultimately and bumps the previous last tab's lastVisit above it", async () => {
		await recentTabs.add(tab(1, "https://a.example.com/"));
		vi.advanceTimersByTime(1000);
		await recentTabs.add(tab(2, "https://b.example.com/"), true);

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([2, 1]);
		expect(tabsByID[1].lastVisit).toBeGreaterThan(tabsByID[2].lastVisit);
	});

	it("re-adding an existing id moves it to the top without duplicating it", async () => {
		await recentTabs.add(tab(1, "https://a.example.com/"));
		await recentTabs.add(tab(2, "https://b.example.com/"));
		await recentTabs.add(tab(1, "https://a-changed.example.com/"));

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([2, 1]);
		expect(tabsByID[1].url).toBe("https://a-changed.example.com/");
	});

	it("trims tabs beyond MaxTabsLength and deletes the oldest from tabsByID", async () => {
		for (let id = 1; id <= 51; id++) {
			await recentTabs.add(tab(id, `https://site${id}.example.com/`));
		}

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs.length).toBe(50);
		expect(tabIDs[0]).toBe(2);
		expect(tabIDs[tabIDs.length - 1]).toBe(51);
		expect(tabsByID[1]).toBeUndefined();
		expect(tabsByID[51]).toBeDefined();
	});
});


describe("recent-tabs remove()", () => {
	it("drops the id from both tabIDs and tabsByID", async () => {
		await recentTabs.add(tab(1, "https://a.example.com/"));
		await recentTabs.add(tab(2, "https://b.example.com/"));
		await recentTabs.remove(1);

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([2]);
		expect(tabsByID[1]).toBeUndefined();
	});
});


describe("recent-tabs replace()", () => {
	it("swaps the id in place in tabIDs and re-keys tabsByID with the new id", async () => {
		await recentTabs.add(tab(1, "https://a.example.com/"));
		await recentTabs.add(tab(2, "https://b.example.com/"));
		await recentTabs.replace(1, 100);

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([100, 2]);
		expect(tabsByID[1]).toBeUndefined();
		expect(tabsByID[100]).toMatchObject({ id: 100, url: "https://a.example.com/", windowId: 1 });
	});
});


describe("recent-tabs toggle()", () => {
	it("switches to the penultimate tab via windows.update then tabs.update", async () => {
		chrome.windows.update = vi.fn(() => Promise.resolve());
		chrome.tabs.update = vi.fn(() => Promise.resolve());

		store._seed({
			tabIDs: [1, 2],
			tabsByID: {
				1: { id: 1, url: "https://a.example.com/", windowId: 10, lastVisit: 100 },
				2: { id: 2, url: "https://b.example.com/", windowId: 10, lastVisit: 200 },
			},
		});

		await recentTabs.toggle();

		expect(chrome.windows.update).toHaveBeenCalledWith(10, { focused: true });
		expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
	});
});


describe("recent-tabs updateAll() / updateFromFreshTabs", () => {
	it("remaps stored recents onto fresh tab ids by matching URL, preserving recency order", async () => {
		store._seed({
			tabIDs: [10, 20],
			tabsByID: {
				10: { id: 10, url: "https://a.example.com/", windowId: 1, lastVisit: 100 },
				20: { id: 20, url: "https://b.example.com/", windowId: 1, lastVisit: 200 },
			},
		});

		chrome.tabs.query = vi.fn(() => Promise.resolve([
			{ id: 200, url: "https://b.example.com/", windowId: 1 },
			{ id: 100, url: "https://a.example.com/", windowId: 1 },
		]));

		await recentTabs.updateAll();

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([100, 200]);
		expect(tabsByID[100]).toMatchObject({ id: 100, url: "https://a.example.com/", lastVisit: 100 });
		expect(tabsByID[200]).toMatchObject({ id: 200, url: "https://b.example.com/", lastVisit: 200 });
		expect(tabsByID[10]).toBeUndefined();
		expect(tabsByID[20]).toBeUndefined();
	});

	it("drops recents whose URL no longer matches any fresh tab", async () => {
		store._seed({
			tabIDs: [10, 20],
			tabsByID: {
				10: { id: 10, url: "https://a.example.com/", windowId: 1, lastVisit: 100 },
				20: { id: 20, url: "https://gone.example.com/", windowId: 1, lastVisit: 200 },
			},
		});

		chrome.tabs.query = vi.fn(() => Promise.resolve([
			{ id: 100, url: "https://a.example.com/", windowId: 1 },
		]));

		await recentTabs.updateAll();

		const { tabIDs, tabsByID } = store._dump();

		expect(tabIDs).toEqual([100]);
		expect(tabsByID[20]).toBeUndefined();
	});
});
