import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetContexts, createContext } from "../support/context";
import popupWindow from "@/background/popup-window";

	// background.js's own handling of the popup and menu ports: a toolbar menu
	// that closes right after opening is a double-press of its shortcut
	// (alt-E by default), which toggles to the previous tab, unless it was
	// closed with esc.  this loads the real background.js; window management,
	// the toolbar icon and the startup sequence are out of scope, so those
	// modules are mocked.

vi.mock("@/background/popup-window", () => ({
	default: {
		tabID: 0,
		isVisible: false,
		hideBehavior: "behind",
		seedSize: vi.fn(() => Promise.resolve()),
		isOpen: vi.fn(() => Promise.resolve(false)),
		create: vi.fn(() => Promise.resolve({})),
		close: vi.fn(() => Promise.resolve()),
		show: vi.fn(() => Promise.resolve({})),
		on: vi.fn(),
		snapshot: vi.fn(() => ({ windowID: 2, tabID: 9, isVisible: true })),
		adopt: vi.fn(),
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

	// the receivers background.js registers on each ipc channel, so a test
	// can make the calls the popup would, since the chrome fake doesn't
	// connect ports between contexts
const ipcReceivers = vi.hoisted(() => ({}));

vi.mock("@/lib/ipc", () => ({
	connect: (channelName) => ({
		call: () => Promise.resolve(),
		receive: (fns) => Object.assign(ipcReceivers[channelName] ??= {}, fns),
	}),
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
		const control = (await import("@/shared/control")).default;

		vi.spyOn(recentTabs, "toggle").mockResolvedValue(false);

		return { recentTabs, control };
	});
}

	// hold the control lock from outside the worker, the way the popup page
	// does.  resolves once the lock is held, with a function that releases it.
function holdControl()
{
	return new Promise((held) => {
		navigator.locks.request("__control__", () => new Promise((release) => held(release)));
	});
}

	// queue for the control lock, the way the popup page does when it loads.
	// returns a function that says whether the lock has been granted.
function queueForControl()
{
	let granted = false;

	navigator.locks.request("__control__", () => {
		granted = true;

		return new Promise(() => {});
	});

	return () => granted;
}

	// disconnect a port after the double-press window, so the disconnect isn't
	// taken as a double-press of the shortcut
function disconnectLater(
	port)
{
	const now = Date.now();

	vi.spyOn(Date, "now").mockReturnValue(now + 1000);
	port.disconnect();
	vi.mocked(Date.now).mockRestore();
}


beforeEach(() => {
	vi.clearAllMocks();
		// clearAllMocks() leaves implementations alone, and a describe below
		// makes the popup look open for all of its tests
	popupWindow.isOpen.mockResolvedValue(false);

	for (const name of Object.keys(ipcReceivers)) {
		delete ipcReceivers[name];
	}

	resetContexts({
		tabs: [
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
			{ id: 2, url: "https://b.example.com/", windowId: 1 },
		],
	});
});


describe("menu port lifecycle", () => {
	it("toggles to the previous tab when the menu closes right after opening", async () => {
		const background = await loadBackground();

		await flush();

		const port = makePort("menu");

		chrome.runtime.onConnect.dispatch(port);
		port.disconnect();
		await flush();

		expect(background.modules.recentTabs.toggle).toHaveBeenCalledTimes(1);
	});

	it("doesn't toggle when the menu was closed with esc", async () => {
		const background = await loadBackground();

		await flush();

		const port = makePort("menu");

		chrome.runtime.onConnect.dispatch(port);
		port.send("closedByEsc");
		port.disconnect();
		await flush();

		expect(background.modules.recentTabs.toggle).not.toHaveBeenCalled();
	});

	it("doesn't toggle when the menu stayed open for a while", async () => {
		const background = await loadBackground();

		await flush();

		const port = makePort("menu");
		const now = Date.now();

		chrome.runtime.onConnect.dispatch(port);
		vi.spyOn(Date, "now").mockReturnValue(now + 1000);
		port.disconnect();
		vi.mocked(Date.now).mockRestore();
		await flush();

		expect(background.modules.recentTabs.toggle).not.toHaveBeenCalled();
	});
});


describe("popup port lifecycle", () => {
	it("closes the popup window when its page's port disconnects", async () => {
		await loadBackground();
		await flush();

		const port = makePort("popup");
		const now = Date.now();

		chrome.runtime.onConnect.dispatch(port);
		vi.spyOn(Date, "now").mockReturnValue(now + 1000);
		port.disconnect();
		vi.mocked(Date.now).mockRestore();
		await flush();

		expect(popupWindow.close).toHaveBeenCalledExactlyOnceWith("popup-port-disconnected");
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

		await ipcReceivers.worker.reopenPopup({ focusSearch: true });

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
		expect(popupWindow.create.mock.calls[0][0]).toMatchObject({ id: activeTab.id });
			// the props the reopened popup is created with
		expect(popupWindow.create.mock.calls[0][1]).toEqual({ focusSearch: true });

			// the reopened popup asks for the active tab when it loads
		expect(ipcReceivers.controller.getActiveTab())
			.toMatchObject({ id: activeTab.id });
	});

	it("prefers the active tab the page passes, which is current when the page holds control", async () => {
		await loadBackground();
		await flush();

		const pageActiveTab = { id: 2, url: "https://b.example.com/", windowId: 1 };

		await ipcReceivers.worker.reopenPopup({ focusSearch: false, activeTab: pageActiveTab });

		expect(popupWindow.create.mock.calls[0][0]).toBe(pageActiveTab);
		expect(ipcReceivers.controller.getActiveTab()).toBe(pageActiveTab);
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


describe("control handoff", () => {
	it("hands control to the popup page when it reports ready, with the state to carry on from", async () => {
		const background = await loadBackground();

		await flush();

		expect(background.modules.control.isHeld()).toBe(true);

			// the page queues for the lock when it loads, before it's ready
		const pageHasControl = queueForControl();
		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
			// opening the popup records the active tab, which the page needs
		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();
		port.send("ready");
		await flush();

		expect(port.postMessage).toHaveBeenLastCalledWith({
			message: "takeControl",
			snapshot: {
				state: expect.objectContaining({ activeTab: expect.objectContaining({ id: 1 }) }),
				popupWindow: { windowID: 2, tabID: 9, isVisible: true },
			},
		});
		expect(port.postMessage.mock.calls.at(-1)[0].snapshot.state).not.toHaveProperty("startingUp");
		expect(background.modules.control.isHeld()).toBe(false);
		expect(pageHasControl()).toBe(true);

			// the worker no longer handles commands
		popupWindow.create.mockClear();
		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(popupWindow.create).not.toHaveBeenCalled();
	});

	it("takes control back when the popup page goes away", async () => {
		const background = await loadBackground();

		await flush();

		let releasePage;

		navigator.locks.request("__control__", () => new Promise((release) => releasePage = release));

		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
		port.send("ready");
		await flush();

		expect(background.modules.control.isHeld()).toBe(false);

			// the page dies: the browser releases its lock, and its port closes
		releasePage();
		disconnectLater(port);
		await flush();

		expect(background.modules.control.isHeld()).toBe(true);

		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});

	it("hands off as soon as it gets control, if the page was ready before it had any", async () => {
			// a previous popup page still holds the lock while this worker starts
			// and a new page reports ready, as when the popup is reopened
		const releaseHolder = await holdControl();
		const background = await loadBackground();

		await flush();

		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
		port.send("ready");
		await flush();

		expect(port.postMessage).not.toHaveBeenCalled();

		const pageHasControl = queueForControl();

		releaseHolder();
		await flush();

		expect(port.postMessage).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ message: "takeControl" }));
		expect(background.modules.control.isHeld()).toBe(false);
		expect(pageHasControl()).toBe(true);
	});

	it("forgets a pending handoff when that page's port disconnects first", async () => {
		const releaseHolder = await holdControl();
		const background = await loadBackground();

		await flush();

		const port = makePort("popup");

		chrome.runtime.onConnect.dispatch(port);
		port.send("ready");
		disconnectLater(port);
		releaseHolder();
		await flush();

		expect(port.postMessage).not.toHaveBeenCalled();
		expect(background.modules.control.isHeld()).toBe(true);
	});

	it("keeps control when the menu reports ready", async () => {
		const background = await loadBackground();

		await flush();

		const port = makePort("menu");

		chrome.runtime.onConnect.dispatch(port);
		port.send("ready");
		await flush();

		expect(port.postMessage).not.toHaveBeenCalled();
		expect(background.modules.control.isHeld()).toBe(true);
	});
});


describe("a frozen popup page holding control", () => {
	const PopupURL = "chrome-extension://quickeyfakeextensionidaaaaaaaaaa/popup.html?props=%7B%7D";

	afterEach(() => {
		popupWindow.tabID = 0;
	});

	async function loadWithPageHoldingControl(
		popupTab)
	{
		resetContexts({
			tabs: [
				{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
				{ id: 9, url: PopupURL, windowId: 2, ...popupTab },
			],
		});
		await holdControl();
		await loadBackground();
		await flush();
		popupWindow.tabID = 9;
	}

	it("is closed when a command arrives, so the worker can take over", async () => {
		await loadWithPageHoldingControl({ frozen: true });

		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(popupWindow.close).toHaveBeenCalledExactlyOnceWith("holder-frozen");
	});

	it("is left alone when it's only busy, or Chrome can't say", async () => {
		await loadWithPageHoldingControl({ frozen: false });

		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(popupWindow.close).not.toHaveBeenCalled();

		await loadWithPageHoldingControl({});

		chrome.commands.onCommand.dispatch("010-open-popup-window");
		await flush();

		expect(popupWindow.close).not.toHaveBeenCalled();
	});

	it("isn't checked for events other than commands", async () => {
		await loadWithPageHoldingControl({ frozen: true });

		chrome.tabs.onActivated.dispatch({ tabId: 1, windowId: 1 });
		await flush();

		expect(popupWindow.close).not.toHaveBeenCalled();
	});
});


describe("the controller channel", () => {
	it("only answers once the worker holds control", async () => {
			// another context, like a popup that took over while the worker was
			// gone, holds control when this worker starts
		let releaseControl;

		await new Promise((held) => navigator.locks.request("__control__", () => {
			held();

			return new Promise((release) => releaseControl = release);
		}));

		await loadBackground();
		await flush();

		expect(ipcReceivers.controller).toBeUndefined();

		releaseControl();
		await flush();

		expect(Object.keys(ipcReceivers.controller))
			.toEqual(["getActiveTab", "flushAddTab", "stopNavigatingRecents"]);
	});
});
