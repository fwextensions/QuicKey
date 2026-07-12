import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetContexts, createContext } from "../support/context";
import popupWindow from "@/background/popup-window";

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
