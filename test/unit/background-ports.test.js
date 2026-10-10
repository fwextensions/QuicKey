import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetContexts, createContext } from "../support/context";
import popupWindow from "@/background/popup-window";

	// background.js's own handling of the popup and menu ports: a popup that
	// closes right after opening is a double-press of the open-popup shortcut,
	// which toggles to the previous tab, unless it was closed with esc.  this
	// loads the real background.js; window management, the toolbar icon and
	// the startup sequence are out of scope, so those modules are mocked.

vi.mock("@/background/popup-window", () => ({
	default: {
		tabID: 0,
		isVisible: false,
		hideBehavior: "behind",
		isOpen: vi.fn(() => Promise.resolve(false)),
		create: vi.fn(() => Promise.resolve({})),
		close: vi.fn(() => Promise.resolve()),
		show: vi.fn(() => Promise.resolve({})),
		on: vi.fn(),
	},
}));

vi.mock("@/background/toolbar-icon", () => ({
	default: {
		isNormal: true,
		setColorScheme: vi.fn(() => Promise.resolve()),
		setNormalIcon: vi.fn(() => Promise.resolve()),
		invertFor: vi.fn(() => Promise.resolve()),
		showTabCount: vi.fn(() => Promise.resolve()),
		updateTabCount: vi.fn(() => Promise.resolve()),
		resyncTabCount: vi.fn(() => Promise.resolve()),
	},
}));

vi.mock("@/background/settings", () => ({
	default: {
		get: () => Promise.resolve({
			showTabCount: false,
			hidePopupBehavior: "behind",
			currentWindowLimitRecents: false,
			navigateRecentsWithPopup: false,
		}),
	},
}));

	// the global error listeners need a window, and have their own tests
vi.mock("@/lib/error-handler", () => ({}));

vi.mock("@/background/startup", () => ({
	default: vi.fn(() => Promise.resolve()),
}));


async function flush(
	times = 4)
{
	for (let i = 0; i < times; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

	// a stand-in for the port popup/init.js connects as soon as the page loads.
	// disconnect() fires the onDisconnect listeners, the way the background
	// sees the popup page going away.
function makePort(
	name)
{
	const messageListeners = new Set();
	const disconnectListeners = new Set();
	const port = {
		name,
		postMessage: vi.fn(),
		onMessage: { addListener: (fn) => messageListeners.add(fn) },
		onDisconnect: { addListener: (fn) => disconnectListeners.add(fn) },
			// test helpers: a message from the popup page, and the page closing
		send: (message) => messageListeners.forEach((fn) => fn(message)),
		disconnect: () => disconnectListeners.forEach((fn) => fn(port)),
	};

	return port;
}

function loadBackground()
{
	return createContext("/background.html", async () => {
		await import("@/background/background");

		const recentTabs = (await import("@/background/recent-tabs")).default;

		vi.spyOn(recentTabs, "toggle").mockResolvedValue(false);

		return { recentTabs };
	});
}


beforeEach(() => {
	vi.clearAllMocks();
	resetContexts({
		tabs: [
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
			{ id: 2, url: "https://b.example.com/", windowId: 1 },
		],
	});
});


describe("popup port lifecycle", () => {
	it("toggles to the previous tab when the popup closes right after opening", async () => {
		const background = await loadBackground();

		await flush();

		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
		port.disconnect();
		await flush();

		expect(background.modules.recentTabs.toggle).toHaveBeenCalledTimes(1);
		expect(popupWindow.close).toHaveBeenCalledWith("popup-port-disconnected");
	});

	it("doesn't toggle when the popup was closed with esc", async () => {
		const background = await loadBackground();

		await flush();

		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
		port.send("closedByEsc");
		port.disconnect();
		await flush();

		expect(background.modules.recentTabs.toggle).not.toHaveBeenCalled();
	});

	it("doesn't toggle when the popup stayed open for a while", async () => {
		const background = await loadBackground();

		await flush();

		const port = makePort("popup");
		const now = Date.now();

		chrome.runtime.onConnect.dispatch(port);
		vi.spyOn(Date, "now").mockReturnValue(now + 1000);
		port.disconnect();
		vi.mocked(Date.now).mockRestore();
		await flush();

		expect(background.modules.recentTabs.toggle).not.toHaveBeenCalled();
	});
});


describe("reopenPopup", () => {
	it("recreates the popup for the same active tab, and keeps that tab as the active one", async () => {
		await loadBackground();
		await flush();

			// opening the popup records the active tab, and its port going
			// away clears it, so connect a port and record the tab through
			// the open-popup command
		const activeTab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
		popupWindow.create.mockClear();

		chrome.runtime.onMessage.dispatch(
			{ message: "reopenPopup", focusSearch: true },
			{},
			() => {}
		);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
		expect(popupWindow.create.mock.calls[0][0]).toMatchObject({ id: activeTab.id });
			// the props the reopened popup is created with
		expect(popupWindow.create.mock.calls[0][1]).toEqual({ focusSearch: true });

			// the reopened popup asks for the active tab when it loads
		const responses = [];

		chrome.runtime.onMessage.dispatch(
			{ message: "getActiveTab" },
			{},
			(response) => responses.push(response)
		);
		await flush();

		expect(responses).toEqual([expect.objectContaining({ id: activeTab.id })]);
	});
});


describe("messages to the popup", () => {
	const PopupTab = {
		id: 9,
		url: "chrome-extension://quickeyfakeextensionidaaaaaaaaaa/popup.html?props=%7B%7D",
		windowId: 2,
		windowType: "popup",
		active: true,
	};

	beforeEach(() => {
			// the popup window is open and focused, so the open-popup shortcut
			// moves its selection down
		resetContexts({ tabs: [PopupTab, { id: 1, url: "https://a.example.com/", windowId: 1 }] });
		popupWindow.isOpen.mockResolvedValue(true);
	});

	it("go over the popup's port, naming the method to call", async () => {
		await loadBackground();
		await flush();

		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(port.postMessage).toHaveBeenCalledExactlyOnceWith({ message: "modifySelected", direction: 1 });
		expect(popupWindow.close).not.toHaveBeenCalled();
	});

	it("go to the menu instead, when it's open", async () => {
		resetContexts({
			tabs: [
				PopupTab,
				{ id: 1, url: "https://a.example.com/", windowId: 1 },
				{ id: 3, url: "https://c.example.com/", windowId: 1 },
			],
		});
		await loadBackground();
		await flush();

		const popupPort = makePort("popup");
		const menuPort = makePort("menu");

		chrome.runtime.onConnect.dispatch(popupPort);
		chrome.runtime.onConnect.dispatch(menuPort);

			// activating a different tab tells the open popup to reload its
			// list, and the menu takes priority over the popup window
		chrome.tabs.onActivated.dispatch({ tabId: 1, windowId: 1 });
		await flush();

		expect(menuPort.postMessage).toHaveBeenCalledExactlyOnceWith({ message: "tabActivated" });
		expect(popupPort.postMessage).not.toHaveBeenCalled();
	});

	it("close the popup window when its port can't deliver them", async () => {
		await loadBackground();
		await flush();

		const port = makePort("popup");

		port.postMessage.mockImplementation(() => {
			throw new Error("Attempting to use a disconnected port object");
		});
		vi.spyOn(console, "error").mockImplementation(() => {});
		chrome.runtime.onConnect.dispatch(port);
		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(popupWindow.close).toHaveBeenCalledExactlyOnceWith("modify-selected-failed");
	});
});
