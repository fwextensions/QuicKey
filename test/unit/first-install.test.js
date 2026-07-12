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

		expect(data.tabIDs).toEqual([5]);
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
