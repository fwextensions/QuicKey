import { describe, it, expect, vi } from "vitest";
import { createChromeFake } from "../support/chrome-fake";
import { createLocksFake } from "../support/locks-fake";

	// what the real quickey-storage module writes on a brand-new install,
	// with the browser environment (open tabs, windows, UI language) driving
	// the tuned defaults.  each test stubs its own chrome fake and navigator
	// before importing the module fresh, since the heuristics run inside the
	// lazy default-data promise on first initialization.

const WindowsUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";


function stubEnvironment({
	tabs = [],
	languages = ["en-US"] } = {})
{
	vi.resetModules();
	vi.stubGlobal("navigator", {
		userAgent: WindowsUA,
		platform: "Win32",
		languages,
		locks: createLocksFake(),
	});
	vi.stubGlobal("chrome", createChromeFake({ tabs }));
}

function flush()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}

	// import a fresh storage singleton over empty chrome.storage.local and
	// let the first-install reset settle
async function firstInstall()
{
	await import("@/background/quickey-storage");

	for (let i = 0; i < 3; i++) {
		await flush();
	}

	return chrome.storage.local._dump();
}


describe("first install", () => {
	it("seeds the currently active tab as the first recent", async () => {
		stubEnvironment({
			tabs: [
				{ id: 5, url: "https://a.example.com/", title: "A", windowId: 1, active: true },
				{ id: 6, url: "https://b.example.com/", title: "B", windowId: 1 },
			],
		});

		const { version, data } = await firstInstall();

			// the active tab is always last, and the other open tab is seeded
			// ahead of it from its lastAccessed time
		expect(data.tabIDs).toEqual([6, 5]);
		expect(data.tabsByID[5]).toMatchObject({ id: 5, url: "https://a.example.com/" });
		expect(data.tabsByID[5].lastVisit).toBeTypeOf("number");

			// a new install has seen everything, so no red "new options" badge
		expect(data.lastSeenOptionsVersion).toBe(version);

			// an English browser with no Chinese tabs doesn't pay for pinyin
		expect(data.settings.usePinyin).toBe(false);

			// one window open: marking tabs in other windows is helpful
		expect(data.settings.markTabsInOtherWindows).toBe(true);
	});

	it("starts with empty recents when there's no active normal-window tab", async () => {
		stubEnvironment();

		const { data } = await firstInstall();

		expect(data.tabIDs).toEqual([]);
		expect(data.tabsByID).toEqual({});
	});

	it("ignores the active tab of a popup-type window", async () => {
		stubEnvironment({
			tabs: [
				{ id: 9, url: "https://p.example.com/", windowId: 1, active: true, windowType: "popup" },
			],
		});

		const { data } = await firstInstall();

		expect(data.tabIDs).toEqual([]);
	});

		// a fresh install has no history of its own, so the open tabs are
		// seeded from Chrome's lastAccessed times rather than showing nothing
	it("seeds the open tabs in lastAccessed order, oldest first", async () => {
		stubEnvironment({
			tabs: [
				{ id: 1, url: "https://a.example.com/", windowId: 1, active: true, lastAccessed: 5000 },
				{ id: 2, url: "https://b.example.com/", windowId: 1, lastAccessed: 1000 },
				{ id: 3, url: "https://c.example.com/", windowId: 2, lastAccessed: 4000 },
				{ id: 4, url: "https://d.example.com/", windowId: 2, lastAccessed: 2000 },
			],
		});

		const { data } = await firstInstall();

			// the active tab stays at the end no matter what its own
			// lastAccessed says, since it's the one the user is on right now
		expect(data.tabIDs).toEqual([2, 4, 3, 1]);
		expect(data.tabsByID[3].lastVisit).toBe(4000);
	});

		// discarded tabs can lose lastAccessed, and moved tabs can corrupt it,
		// so those tabs sort below the ones we have real times for instead of
		// dropping out of the seeded list
	it("sorts tabs with no lastAccessed below the ones that have it", async () => {
		stubEnvironment({
			tabs: [
				{ id: 1, url: "https://a.example.com/", windowId: 1, active: true, lastAccessed: 5000 },
				{ id: 2, url: "https://b.example.com/", windowId: 1, lastAccessed: 3000 },
				{ id: 3, url: "https://c.example.com/", windowId: 1 },
			],
		});

		const { data } = await firstInstall();

		expect(data.tabIDs).toEqual([3, 2, 1]);
		expect(data.tabsByID[3].lastVisit).toBeLessThan(data.tabsByID[2].lastVisit);
	});

	it("caps the seeded recents at the max list length", async () => {
		stubEnvironment({
			tabs: Array.from({ length: 60 }, (_, i) => ({
				id: i + 1,
				url: `https://t${i}.example.com/`,
				windowId: 1,
				active: i === 0,
				lastAccessed: 1000 + i,
			})),
		});

		const { data } = await firstInstall();

		expect(data.tabIDs.length).toBe(50);
			// the oldest tabs are the ones dropped, and the active tab is last
		expect(data.tabIDs[0]).toBe(12);
		expect(data.tabIDs.at(-1)).toBe(1);
	});

	it("defaults usePinyin on for a Chinese-locale browser", async () => {
		stubEnvironment({ languages: ["zh-CN"] });

		const { data } = await firstInstall();

		expect(data.settings.usePinyin).toBe(true);
	});

	it("defaults usePinyin on when any open tab's title has Han characters", async () => {
		stubEnvironment({
			tabs: [
				{ id: 1, url: "https://a.example.com/", title: "Docs", windowId: 1, active: true },
				{ id: 2, url: "https://zh.wikipedia.org/", title: "维基百科", windowId: 1 },
			],
		});

		const { data } = await firstInstall();

		expect(data.settings.usePinyin).toBe(true);
	});

	it("defaults usePinyin on when a tab's URL has encoded Han characters", async () => {
		stubEnvironment({
			tabs: [
				{ id: 1, url: "https://a.example.com/", title: "A", windowId: 1, active: true },
				{
					id: 2,
					url: "https://zh.wikipedia.org/wiki/%E7%BB%B4%E5%9F%BA",
					title: "wiki",
					windowId: 1,
				},
			],
		});

		const { data } = await firstInstall();

		expect(data.settings.usePinyin).toBe(true);
	});

	it("defaults markTabsInOtherWindows off for a heavy multi-window user", async () => {
		stubEnvironment({
			tabs: [1, 2, 3, 4].map((windowId) => ({
				id: windowId * 10,
				url: `https://w${windowId}.example.com/`,
				windowId,
				active: windowId === 1,
			})),
		});

		const { data } = await firstInstall();

		expect(data.settings.markTabsInOtherWindows).toBe(false);
	});
});
