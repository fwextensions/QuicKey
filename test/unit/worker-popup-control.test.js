import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetContexts, createContext } from "../support/context";
import popupWindow from "@/background/popup-window";
import settings from "@/background/settings";

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
		seedSize: vi.fn(() => Promise.resolve()),
		isOpen: vi.fn(() => Promise.resolve(false)),
		create: vi.fn(() => Promise.resolve({})),
		close: vi.fn(() => Promise.resolve()),
		show: vi.fn(() => Promise.resolve({})),
		on: vi.fn(),
		loadHideBehavior: vi.fn(function(value) { this.hideBehavior = value; }),
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
const DefaultSettings = {
	showTabCount: false,
	hidePopupBehavior: "behind",
	currentWindowLimitRecents: false,
	navigateRecentsWithPopup: false,
};

vi.mock("@/background/settings", () => ({
	default: {
		get: vi.fn(() => Promise.resolve(DefaultSettings)),
	},
}));

const OpenPopupCommand = "010-open-popup-window";
const PreviousTabCommand = "1-previous-tab";

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
		const state = (await import("@/shared/state")).default;
		const sendPopupMessage = vi.fn();
		const sendMessage = initEventController({ sendPopupMessage, ports: {} });

		return { control, state, sendMessage, sendPopupMessage };
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

	it("opens a new popup for the shortcut's tab without querying for the active tab", async () => {
		const worker = await loadContext("/background.html");

		await flush();

		const querySpy = vi.spyOn(chrome.tabs, "query");
		const commandTab = { id: 7, url: "https://b.example.com/", windowId: 2, active: true };

		chrome.commands.onCommand.dispatch(OpenPopupCommand, commandTab);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledOnce();
		expect(popupWindow.create.mock.calls[0][0]).toBe(commandTab);
		expect(worker.modules.state.activeTab).toBe(commandTab);
		expect(querySpy).not.toHaveBeenCalledWith(expect.objectContaining({ lastFocusedWindow: true }));
	});

	it("a cold-start alt-shift-A waits for the settings before choosing to open the popup", async () => {
			// hold the settings read open, the way a cold start's slow first
			// storage read does, while the command that woke the worker arrives
		const { promise, resolve } = Promise.withResolvers();

		settings.get.mockImplementationOnce(() => promise);

		await loadContext("/background.html");

		chrome.commands.onCommand.dispatch(PreviousTabCommand);
		await flush();

		expect(popupWindow.create).not.toHaveBeenCalled();

		resolve({ ...DefaultSettings, navigateRecentsWithPopup: true });
		await flush();

		expect(popupWindow.create).toHaveBeenCalledOnce();
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


describe("settings changed while the popup holds control", () => {
		// on macOS, switching hidePopupBehavior to minimize was ignored the
		// first time: the popup held control and handled the settingChanged,
		// then closed itself, handing control back to a worker that had read
		// the settings before the change and never heard about it
	async function popupInControlWithWaitingWorker()
	{
		const oldWorker = await loadContext("/background.html");

		await flush();

		const popup = await loadContext("/popup.html");

		await flush();

		oldWorker.destroy();
		await flush();

			// a tab event wakes a new worker, which reads the settings at init
			// and then waits for control behind the popup
		const worker = await loadContext("/background.html");

		await flush();

		expect(popup.modules.control.isHeld()).toBe(true);
		expect(worker.modules.control.isHeld()).toBe(false);
		expect(popupWindow.hideBehavior).toBe("behind");

		return { popup, worker };
	}

	it("the worker rereads the settings when it takes control after missing a change", async () => {
		const { popup, worker } = await popupInControlWithWaitingWorker();
		const changed = { ...DefaultSettings, hidePopupBehavior: "minimize" };

		settings.get.mockImplementation(() => Promise.resolve(changed));

		try {
			chrome.runtime.onMessage.dispatch({ message: "settingChanged",
				key: "hidePopupBehavior", value: "minimize" }, {}, () => {});
			await flush();

				// the popup closes itself after a hidePopupBehavior change.  reset
				// the shared mock, so only the worker can set it back.
			popupWindow.hideBehavior = "behind";
			popup.destroy();
			await flush();

			expect(worker.modules.control.isHeld()).toBe(true);
			expect(popupWindow.hideBehavior).toBe("minimize");
		} finally {
			settings.get.mockImplementation(() => Promise.resolve(DefaultSettings));
			popupWindow.hideBehavior = "behind";
		}
	});

	it("loading the settings when the popup takes control doesn't close it", async () => {
		const stored = { ...DefaultSettings, hidePopupBehavior: "minimize" };

		settings.get.mockImplementation(() => Promise.resolve(stored));

		try {
			const worker = await loadContext("/background.html");

			await flush();

			const popup = await loadContext("/popup.html");

			await flush();
			popupWindow.close.mockClear();

				// the worker goes idle, so the popup takes control and loads
				// the settings
			worker.destroy();
			await flush();

			expect(popup.modules.control.isHeld()).toBe(true);
			expect(popupWindow.loadHideBehavior).toHaveBeenLastCalledWith("minimize");
			expect(popupWindow.close).not.toHaveBeenCalled();
		} finally {
			settings.get.mockImplementation(() => Promise.resolve(DefaultSettings));
			popupWindow.hideBehavior = "behind";
		}
	});

	it("the worker doesn't reread the settings if nothing changed", async () => {
		const { popup } = await popupInControlWithWaitingWorker();
		const calls = settings.get.mock.calls.length;

		popup.destroy();
		await flush();

		expect(settings.get).toHaveBeenCalledTimes(calls);
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
