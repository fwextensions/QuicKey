import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetContexts, createContext } from "../support/context";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";

	// the full worker/popup coordination story, driven through the real
	// eventController graph (control, controlledEvent, tabEventHandlers,
	// commandHandlers, recent-tabs, quickey-storage) in two simulated
	// contexts: a service worker at /background.html and a popup at
	// /popup.html.  the two module graphs are independent -- each has its own
	// control.isHeld() -- but share one chrome fake and one lock manager,
	// exactly like production.  window management and the toolbar icon are
	// out of scope here, so those leaf modules are mocked.

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
	},
}));

	// the real settings module derives chrome shortcut info that's irrelevant
	// here; commandHandlers only reads these four keys once it takes control
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

const OpenPopupCommand = "010-open-popup-window";

	// several macrotasks, so multi-step promise chains (storage init, lock
	// grants, controlHeldFuncs) fully settle
async function flush(
	times = 4)
{
	for (let i = 0; i < times; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

	// stand up one extension context: import the graph, start the event
	// controller the way background.js / the popup's init do, and hand back
	// the modules the tests poke at
function loadContext(
	pathname)
{
	return createContext(pathname, async () => {
		const initEventController = (await import("@/shared/eventController")).default;
		const control = (await import("@/shared/control")).default;
		const popupMessages = [];
		let failNext = false;
			// no popup or menu is connected in these tests; the messages the
			// controller sends are recorded instead
		const popupLink = {
			isPopupConnected: () => false,
			isMenuConnected: () => false,
			notify: async (name, payload = {}) => {
				popupMessages.push([name, payload]);

				const delivered = !failNext;

				failNext = false;

				return delivered;
			},
		};
		const { controller, sendMessage } = initEventController({ popupLink });

		return {
			control,
			state: controller.state,
			sendMessage,
				// the messages the controller sent to the popup, as [name, payload]
			popupMessages: () => popupMessages,
				// make the next message to the popup fail to be delivered
			failNextPopupMessage: () => failNext = true,
		};
	});
}


beforeEach(() => {
		// the vi.mock factories above run once for the whole file, so the mock
		// instances (popupWindow etc.) are shared by every context and every
		// test; clear their call history between tests
	vi.clearAllMocks();
	resetContexts({
		tabs: [{ id: 1, url: "https://a.example.com/", windowId: 1, active: true }],
	});
});


describe("worker alone", () => {
	it("claims control at startup and answers popup messages locally, not via chrome.runtime", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		expect(worker.modules.control.isHeld()).toBe(true);

		const sendMessageSpy = vi.spyOn(chrome.runtime, "sendMessage");

		worker.modules.state.activeTab = { id: 42, url: "https://a.example.com/" };

		const response = await worker.modules.sendMessage("getActiveTab", {}, true);

		expect(response).toMatchObject({ id: 42 });
		expect(sendMessageSpy).not.toHaveBeenCalled();
	});
});


describe("worker and popup", () => {
	it("a popup that doesn't hold control routes messages through chrome.runtime instead", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		const popup = await loadContext("/popup.html");

		await flush();

		expect(worker.modules.control.isHeld()).toBe(true);
		expect(popup.modules.control.isHeld()).toBe(false);

		const sendMessageSpy = vi.spyOn(chrome.runtime, "sendMessage");

		await popup.modules.sendMessage("getActiveTab", {}, true);

		expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({ message: "getActiveTab" });
	});

	it("a command is handled exactly once, by the context that holds control", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		const popup = await loadContext("/popup.html");

		await flush();

		expect(worker.modules.control.isHeld()).toBe(true);
		expect(popup.modules.control.isHeld()).toBe(false);

			// both contexts have a controlled onCommand listener attached, but
			// only the worker's passes its isHeld() gate -- if the popup's ran
			// too, the shared popup-window mock would see two create() calls
		expect(chrome.commands.onCommand.listenerCount()).toBe(2);

		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});

	it("when the worker dies, the queued popup inherits control and takes over both roles", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		const popup = await loadContext("/popup.html");

		await flush();

			// both contexts have a controlled onCommand listener attached
		expect(chrome.commands.onCommand.listenerCount()).toBe(2);

			// MV3 reaps the idle worker: its chrome listeners disappear with its
			// context and the browser revokes its control lock
		worker.destroy();
		await flush();

		expect(chrome.commands.onCommand.listenerCount()).toBe(1);
		expect(popup.modules.control.isHeld()).toBe(true);

			// the popup now answers messages locally...
		const sendMessageSpy = vi.spyOn(chrome.runtime, "sendMessage");

		popup.modules.state.activeTab = { id: 7, url: "https://a.example.com/" };

		const response = await popup.modules.sendMessage("getActiveTab", {}, true);

		expect(response).toMatchObject({ id: 7 });
		expect(sendMessageSpy).not.toHaveBeenCalled();

			// ...and handles commands, exactly once, with the dead worker silent
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});
});


describe("toolbar menu open", () => {
	const MenuContext = {
		contextType: "POPUP",
		documentUrl: "chrome-extension://quickeyfakeextensionidaaaaaaaaaa/popup.html",
	};

		// the real menu holds this lock while open (popup/init.js); the
		// background checks it via isMenuOpen().  returns once the lock is
		// held, and sets closeMenuLock to release it, which is what happens
		// when the menu page goes away.
	let closeMenuLock;

	function holdMenuLock()
	{
		return new Promise((ready) => {
			navigator.locks.request("__menu-open__", () => {
				ready();

				return new Promise((release) => closeMenuLock = release);
			});
		});
	}

		// a minimal stand-in for the port the menu connects when it opens.
		// disconnect() fires the onDisconnect listeners, like the real port
		// does in every other context when the menu closes.
	function makeMenuPort()
	{
		const disconnectListeners = new Set();

		return {
			name: "menu",
			postMessage: () => {},
			onMessage: { addListener: () => {} },
			onDisconnect: { addListener: (fn) => disconnectListeners.add(fn) },
			disconnect: () => disconnectListeners.forEach((fn) => fn()),
		};
	}

	it("the worker ignores commands while the menu is open, and handles them again after it closes", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		expect(worker.modules.control.isHeld()).toBe(true);

			// the menu handles keyboard events itself while it's open, so a
			// command arriving then must be dropped, like the MV2 background
			// page did by removing its onCommand listener
		chrome.runtime._setContexts([MenuContext]);
		await holdMenuLock();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).not.toHaveBeenCalled();

		chrome.runtime._setContexts([]);
		closeMenuLock();
		await flush();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});

	it("a stale POPUP context left behind after the menu closes doesn't block commands", async () => {
		const worker = await loadContext("/background.html");

		await flush();

			// the menu connects a port when it opens, which every context sees,
			// so commandHandlers tracks the open state from the port events
		const menuPort = makeMenuPort();

		chrome.runtime._setContexts([MenuContext]);
		chrome.runtime.onConnect.dispatch(menuPort);
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).not.toHaveBeenCalled();

			// the menu closes, but getContexts() keeps (wrongly) reporting its
			// POPUP context.  the tracked port state knows better, so commands
			// must work again instead of being silently dropped forever.
		menuPort.disconnect();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});

	it("a getContexts() failure doesn't drop commands", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		vi.spyOn(chrome.runtime, "getContexts")
			.mockRejectedValue(new Error("no getContexts for you"));

		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});

	it("a worker that starts while the menu is already open re-enables commands when the menu closes", async () => {
			// the user opened the menu, the old worker died, and a new worker
			// was started: it never saw the menu's port connect, and the
			// menu's port disconnect will fire against the dead worker, so
			// the lock release is the only close signal it will ever get.
			// getContexts() stale-reports the menu the whole time.
		chrome.runtime._setContexts([MenuContext]);
		await holdMenuLock();

		const worker = await loadContext("/background.html");

		await flush();

		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).not.toHaveBeenCalled();

		closeMenuLock();
		await flush();

		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});

	it("a popup that holds control also ignores commands while the menu is open", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		const popup = await loadContext("/popup.html");

		await flush();
		worker.destroy();
		await flush();

		expect(popup.modules.control.isHeld()).toBe(true);

			// this is the case the port-based tracking in the background could
			// never see: the popup process is handling commands, but only the
			// worker got the menu's onConnect.  the lock check works from
			// either context.
		chrome.runtime._setContexts([MenuContext]);
		await holdMenuLock();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).not.toHaveBeenCalled();

		chrome.runtime._setContexts([]);
		closeMenuLock();
		await flush();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
	});
});


describe("messages between the popup and the controller", () => {
	const PopupTab = {
		id: 9,
		url: "chrome-extension://quickeyfakeextensionidaaaaaaaaaa/popup.html?props=%7B%7D",
		windowId: 2,
		windowType: "popup",
		active: true,
	};

	it("a setting changed on the options page reaches a popup that holds control", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		const popup = await loadContext("/popup.html");

		await flush();
		worker.destroy();
		await flush();

		expect(popup.modules.control.isHeld()).toBe(true);

			// the options page broadcasts the change, and only the context
			// that holds control is listening for it
		chrome.runtime.onMessage.dispatch(
			{ message: "settingChanged", key: "showTabCount", value: true },
			{},
			() => {}
		);
		chrome.runtime.onMessage.dispatch(
			{ message: "settingChanged", key: "hidePopupBehavior", value: "tab" },
			{},
			() => {}
		);
		await flush();

		expect(toolbarIcon.showTabCount).toHaveBeenLastCalledWith(true);
		expect(popupWindow.hideBehavior).toBe("tab");

		popupWindow.hideBehavior = "behind";
	});

	it("closes the popup window when a selection change can't be delivered to it", async () => {
			// the popup window is open and focused, so the open-popup shortcut
			// moves its selection down instead of opening another one
		resetContexts({ tabs: [PopupTab, { id: 1, url: "https://a.example.com/", windowId: 1 }] });
		popupWindow.isOpen.mockResolvedValueOnce(true);

		const worker = await loadContext("/background.html");

		await flush();
		worker.modules.failNextPopupMessage();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(worker.modules.popupMessages()).toEqual([["modifySelected", { direction: 1 }]]);
		expect(popupWindow.close).toHaveBeenCalledExactlyOnceWith("modify-selected-failed");
	});

	it("leaves the popup window open when the selection change is delivered", async () => {
		resetContexts({ tabs: [PopupTab, { id: 1, url: "https://a.example.com/", windowId: 1 }] });
		popupWindow.isOpen.mockResolvedValueOnce(true);

		const worker = await loadContext("/background.html");

		await flush();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(worker.modules.popupMessages()).toEqual([["modifySelected", { direction: 1 }]]);
		expect(popupWindow.close).not.toHaveBeenCalled();
	});
});
