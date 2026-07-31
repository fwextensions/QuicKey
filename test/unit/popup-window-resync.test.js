import { describe, it, expect, beforeEach, vi } from "vitest";

	// popup-window.js is imported by both the service worker and the popup
	// page, and each context gets its own copy of the module-level windowID /
	// tabID / isHiddenInTab.  when the popup page has control it calls show()
	// against its own copy (see popup/popup-window.js), so whichever context
	// didn't create the current popup window is left holding a windowID that
	// Chrome has since destroyed -- observed in the field as
	// "No window with id: 775138942" with the tab ID still correct, since the
	// popup document had stayed loaded across several window recreations.

	// screen.js reads chrome.system.display, which the chrome fake doesn't
	// model.  the exact bounds don't matter here -- only which window show()
	// targets -- so report a single fixed screen.
vi.mock("@/background/screen", () => ({
	getScreenFromWindow: () => ({
		left: 0,
		top: 0,
		width: 1920,
		height: 1080,
		right: 1920,
		bottom: 1080,
	}),
}));

const PopupPath = "popup.html";

function popupURL()
{
	return chrome.runtime.getURL(PopupPath);
}

	// point runtime.getContexts() at wherever the popup tab currently lives,
	// which is what getExistingPopupID() reads to derive the IDs
function setPopupContext()
{
	const tab = chrome.tabs._dump().tabs.find(({ url }) => url === popupURL());

	chrome.runtime._setContexts(tab
		? [{ contextType: "TAB", tabId: tab.id, windowId: tab.windowId, documentUrl: tab.url }]
		: []);

	return tab;
}

	// the module runs top-level await, so it has to be imported after the
	// chrome fake is seeded, with a fresh registry each time
async function loadPopupWindow()
{
	vi.resetModules();

	const { default: popupWindow } = await import("@/background/popup-window");

	return popupWindow;
}

beforeEach(() => {
	chrome.storage.local.clear();
	chrome.tabs._seed([
		{ id: 1, url: "https://a.example.com/", windowId: 1 },
		{ id: 2, url: popupURL(), windowId: 2, windowType: "popup" },
	]);
	setPopupContext();
});


describe("popup-window show() resync", () => {
	it("picks up the popup's window ID on load", async () => {
		const popupWindow = await loadPopupWindow();

		expect(popupWindow.id).toBe(2);
		expect(popupWindow.tabID).toBe(2);
	});

		// the exact field failure: this context's windowID names a window that
		// another context has already replaced
	it("recovers when its cached windowID no longer exists", async () => {
		const popupWindow = await loadPopupWindow();

		expect(popupWindow.id).toBe(2);

			// another context moved the popup tab into a new popup window and
			// the old one went away, which this context never saw
		const newWindow = await chrome.windows.create({ tabId: 2, type: "popup" });

		expect(newWindow.id).not.toBe(2);
		setPopupContext();

		const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

		await expect(popupWindow.show(activeTab)).resolves.toBeTruthy();

			// the stale ID is gone; the next show() won't have to retry
		expect(popupWindow.id).toBe(newWindow.id);
	});

		// after resyncing, the popup may turn out to be parked in a normal
		// window.  a stale isVisible would send show() back to the
		// windows.update() branch, which has no valid ID to update in that
		// case, so the resync has to clear it
	it("creates a popup window when the resync finds the tab in a normal window", async () => {
		const popupWindow = await loadPopupWindow();

			// show it once so isVisible latches true
		const [firstTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

		await popupWindow.show(firstTab);
		expect(popupWindow.isVisible).toBe(true);

			// another context stashed the popup tab in the normal window and
			// dropped its popup window
		await chrome.tabs.move(2, { windowId: 1, index: -1 });
		setPopupContext();

		const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
		const window = await popupWindow.show(activeTab);

		expect(window).toBeTruthy();
		expect(window.type).toBe("popup");

			// the tab ended up in a real popup window, not left in the normal one
		const movedTab = chrome.tabs._dump().tabs.find(({ id }) => id === 2);

		expect(movedTab.windowId).toBe(window.id);
		expect(movedTab.windowId).not.toBe(1);
	});

		// nothing to resync to -- show() should give up quietly rather than throw
		// into whatever called it from the command handler
	it("doesn't throw when there's no popup context to resync to", async () => {
		const popupWindow = await loadPopupWindow();

		await chrome.tabs.remove(2);
		chrome.runtime._setContexts([]);

		const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

		await expect(popupWindow.show(activeTab)).resolves.toBeUndefined();
	});
});
