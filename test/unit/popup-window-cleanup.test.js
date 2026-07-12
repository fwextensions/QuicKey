import { describe, it, expect, beforeEach } from "vitest";
import { resetContexts, createContext } from "../support/context";

	// the real popup-window module, stood up in a simulated background context.
	// these tests cover the orphaned-popup cleanup that runs when the module
	// initializes: reloading the extension destroys the popup page's context
	// and Chrome navigates its tab to the new tab page, so the new instance
	// can't find it via getContexts() or a popup.html URL query.  the module
	// persists the popup's window/tab IDs in chrome.storage.local and closes
	// whatever they still point to at startup.

const LastPopupIDsKey = "lastPopupIDs";
const PopupURL = "chrome-extension://quickeyfakeextensionidaaaaaaaaaa/popup.html";

	// several macrotasks, so storage init and the screen-info query settle
async function flush(
	times = 4)
{
	for (let i = 0; i < times; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

	// import the real popup-window graph in a background context; its
	// top-level awaits (including the orphan cleanup) finish before the
	// import resolves
function loadPopupWindow()
{
	return createContext("/background.html", async () => ({
		popupWindow: (await import("@/background/popup-window")).default,
	}));
}

function seedStoredIDs(
	windowID,
	tabID)
{
	return chrome.storage.local.set({ [LastPopupIDsKey]: { windowID, tabID } });
}

async function getStoredIDs()
{
	return (await chrome.storage.local.get(LastPopupIDsKey))[LastPopupIDsKey];
}


beforeEach(() => {
	resetContexts();
});


describe("orphaned popup cleanup at startup", () => {
	it("closes a popup window stranded on the new tab page after a reload", async () => {
		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
			{ id: 2, url: "chrome://newtab/", windowId: 2, windowType: "popup" },
		]);
		await seedStoredIDs(2, 2);

		await loadPopupWindow();

		const { windows, tabs } = chrome.tabs._dump();

		expect(windows.map(({ id }) => id)).toEqual([1]);
		expect(tabs.map(({ id }) => id)).toEqual([1]);
		expect(await getStoredIDs()).toEqual({ windowID: 0, tabID: 0 });
	});


	it("closes an orphaned popup tab that was hiding in a normal window", async () => {
		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
			{ id: 2, url: "chrome://newtab/", windowId: 1 },
		]);
		await seedStoredIDs(0, 2);

		await loadPopupWindow();

		const { windows, tabs } = chrome.tabs._dump();

		expect(windows.map(({ id }) => id)).toEqual([1]);
		expect(tabs.map(({ id }) => id)).toEqual([1]);
		expect(await getStoredIDs()).toEqual({ windowID: 0, tabID: 0 });
	});


	it("leaves a normal window alone even when the stored IDs point at it", async () => {
			// simulates a browser restart recycling the stored window/tab IDs
			// for a window the user cares about
		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
		]);
		await seedStoredIDs(1, 1);

		await loadPopupWindow();

		const { windows, tabs } = chrome.tabs._dump();

		expect(windows.map(({ id }) => id)).toEqual([1]);
		expect(tabs.map(({ id }) => id)).toEqual([1]);
			// the stale IDs should still get cleared
		expect(await getStoredIDs()).toEqual({ windowID: 0, tabID: 0 });
	});


	it("adopts a live popup when only the service worker restarted", async () => {
		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
			{ id: 2, url: `${PopupURL}?props=%7B%7D`, windowId: 2, windowType: "popup" },
		]);
		await seedStoredIDs(2, 2);

			// unlike after a full reload, the popup page is still alive, so
			// getContexts() can see it
		chrome.runtime.getContexts = () => Promise.resolve([
			{ tabId: 2, windowId: 2, documentUrl: `${PopupURL}?props=%7B%7D` },
		]);

		const context = await loadPopupWindow();
		const { windows, tabs } = chrome.tabs._dump();

		expect(windows.map(({ id }) => id)).toEqual([1, 2]);
		expect(tabs.map(({ id }) => id)).toEqual([1, 2]);
		expect(context.modules.popupWindow.id).toBe(2);
		expect(context.modules.popupWindow.tabID).toBe(2);
			// the popup is still open, so its IDs should stay stored
		expect(await getStoredIDs()).toEqual({ windowID: 2, tabID: 2 });
	});


	it("closes the previous instance's popup window across a simulated reload", async () => {
		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
		]);

		const first = await loadPopupWindow();

		await flush();

		const win = await first.modules.popupWindow.create({ id: 1, windowId: 1 }, {});
		const [popupTab] = win.tabs;

			// creating the popup should have persisted its IDs
		expect(await getStoredIDs()).toEqual({ windowID: win.id, tabID: popupTab.id });

			// simulate the extension being reloaded: the old context dies and
			// Chrome navigates the popup's tab to the new tab page
		first.destroy();
		await chrome.tabs.update(popupTab.id, { url: "chrome://newtab/" });

		await loadPopupWindow();

		const { windows, tabs } = chrome.tabs._dump();

		expect(windows.map(({ id }) => id)).toEqual([1]);
		expect(tabs.map(({ id }) => id)).toEqual([1]);
		expect(await getStoredIDs()).toEqual({ windowID: 0, tabID: 0 });
	});
});
