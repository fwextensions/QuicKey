import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeFake } from "../support/chrome-fake";
import initEventController from "@/shared/eventController";
import { toggleRecentTabs } from "@/shared/commandHandlers";
import trackers from "@/background/page-trackers";

// Keep the real popup selection method and background message listener, while
// leaving unrelated startup and UI coordination out of this regression.
vi.mock("@/lib/error-handler", () => ({}));
vi.mock("@/background/startup", () => ({ default: vi.fn() }));
vi.mock("@/shared/eventController", () => ({
	default: vi.fn(() => vi.fn(() => Promise.resolve())),
}));
vi.mock("@/shared/commandHandlers", () => ({ toggleRecentTabs: vi.fn() }));
vi.mock("@/background/popup-window", () => ({
	default: { isVisible: false, close: vi.fn(), create: vi.fn(), on: vi.fn() },
}));
vi.mock("@/background/toolbar-icon", () => ({ default: {} }));

let App;
let menu;

beforeEach(async () => {
	vi.clearAllMocks();
	vi.resetModules();
	vi.stubGlobal("chrome", createChromeFake({
		tabs: [
			{ id: 1, windowId: 1, active: true, url: "https://example.com/one" },
			{ id: 2, windowId: 1, active: false, url: "https://example.com/two" },
		],
	}));

	await import("@/background/background");
	App = (await import("@/popup/app")).default;
	vi.spyOn(App.prototype, "updateSettings").mockResolvedValue({});
	menu = new App({
		isPopup: false,
		initialQuery: "two",
		focusSearch: true,
		navigatingRecents: false,
		tracker: { event: vi.fn(), exception: vi.fn(), set: vi.fn() },
	});
	menu.blurPopupWindow = vi.fn(() => Promise.resolve());
	menu.closeWindow = vi.fn();
	menu.executeAddTab = vi.fn();
});

function dismissMenuWhenFocusing(
	port)
{
	const updateWindow = chrome.windows.update.bind(chrome.windows);
	let handlingInWorker = false;

	// Focusing the browser window dismisses the toolbar menu. A promise
	// started in that menu cannot continue after its context is destroyed,
	// but a promise started by the service worker can.
	vi.spyOn(chrome.windows, "update").mockImplementation((...args) => {
		port?.onDisconnect.dispatch(port);

		if (!handlingInWorker) {
			return new Promise(() => {});
		}

		return updateWindow(...args);
	});
	vi.spyOn(chrome.runtime, "sendMessage").mockImplementation((message) => {
		handlingInWorker = true;
		chrome.runtime.onMessage.dispatch(message, {}, () => {});
		handlingInWorker = false;

		// The menu has gone away before a response can be delivered.
		return new Promise(() => {});
	});
}

async function flush()
{
	await new Promise(resolve => setTimeout(resolve, 0));
}

describe("toolbar menu tab selection", () => {
	it("activates the selected tab even if focusing the window closes the menu", async () => {
		dismissMenuWhenFocusing();
		menu.openItem({
			id: 2, windowId: 1, url: "https://example.com/two",
		});
		await flush();

		const [activeTab] = await chrome.tabs.query({ active: true, windowId: 1 });

		expect(activeTab.id).toBe(2);
		expect(initEventController.mock.results[0].value)
			.toHaveBeenCalledWith("executeAddTab", {}, true);
	});

	it("focuses a tab in another window and preserves an unsuspend URL", async () => {
		chrome.tabs._seed([
			{ id: 1, windowId: 1, active: true, url: "https://example.com/one" },
			{ id: 3, windowId: 2, active: true, url: "https://example.com/three" },
			{ id: 2, windowId: 2, active: false, url: "https://example.com/suspended" },
		]);
		dismissMenuWhenFocusing();
		menu.openItem({
			id: 2,
			windowId: 2,
			url: "https://example.com/suspended",
			unsuspendURL: "https://example.com/restored",
		}, true);
		await flush();

		const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

		expect(activeTab).toMatchObject({
			id: 2, windowId: 2, url: "https://example.com/restored",
		});
	});

	it("does not mistake a quick selection for a double-press toggle", async () => {
		const port = chrome.runtime.connect();

		port.name = "menu";
		chrome.runtime.onConnect.dispatch(port);
		dismissMenuWhenFocusing(port);
		menu.openItem({
			id: 2, windowId: 1, url: "https://example.com/two",
		});
		await flush();

		expect(toggleRecentTabs).not.toHaveBeenCalled();
		expect((await chrome.tabs.query({ active: true, windowId: 1 }))[0].id).toBe(2);
	});

	it("still toggles on a quick menu close without a selection", () => {
		const port = chrome.runtime.connect();

		port.name = "menu";
		chrome.runtime.onConnect.dispatch(port);
		port.onDisconnect.dispatch(port);

		expect(toggleRecentTabs).toHaveBeenCalledOnce();
	});

	it("keeps the standalone popup's direct focus behavior", async () => {
		menu.props.isPopup = true;
		const sendMessage = vi.spyOn(chrome.runtime, "sendMessage");

		const focusedTab = await App.prototype.focusTab.call(menu, {
			id: 2, windowId: 1, url: "https://example.com/two",
		});

		expect(focusedTab.id).toBe(2);
		expect(menu.executeAddTab).toHaveBeenCalledOnce();
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it("reports a failure in the background if the selected window is gone", async () => {
		const exception = vi.spyOn(trackers.background, "exception");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const response = new Promise(resolve => {
			chrome.runtime.onMessage.dispatch({
				message: "focusMenuTab", windowId: 999, tabId: 2,
			}, {}, resolve);
		});

		await expect(response).resolves.toBeUndefined();
		expect(exception).toHaveBeenCalledOnce();
		expect(initEventController.mock.results[0].value).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
