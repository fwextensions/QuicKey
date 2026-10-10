import { describe, it, expect, beforeEach, vi } from "vitest";
import { createChromeFake } from "../support/chrome-fake";
import { createLocksFake } from "../support/locks-fake";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";
import recentTabs from "@/background/recent-tabs";
import { CommandIDs } from "@/background/constants";

	// one controller, driven directly: commands and settings go in, and the
	// assertions check what it asks of the popup (through a scripted
	// popupLink), the popup window and the recents.  the leaf modules it
	// drives are mocked, so this is only the controller's own decisions.

vi.mock("@/background/popup-window", () => ({
	default: {
		tabID: 0,
		isVisible: false,
		hideBehavior: "behind",
		isOpen: vi.fn(() => Promise.resolve(false)),
		create: vi.fn(() => Promise.resolve({})),
		close: vi.fn(() => Promise.resolve()),
		on: vi.fn(),
	},
}));

vi.mock("@/background/toolbar-icon", () => ({
	default: {
		isNormal: true,
		setNormalIcon: vi.fn(() => Promise.resolve()),
		invertFor: vi.fn(() => Promise.resolve()),
		showTabCount: vi.fn(() => Promise.resolve()),
		updateTabCount: vi.fn(() => Promise.resolve()),
	},
}));

vi.mock("@/background/recent-tabs", () => ({
	default: {
		add: vi.fn(() => Promise.resolve()),
		remove: vi.fn(() => Promise.resolve()),
		replace: vi.fn(() => Promise.resolve()),
		navigate: vi.fn(() => Promise.resolve()),
		toggle: vi.fn(() => Promise.resolve(false)),
	},
}));

const storedSettings = vi.hoisted(() => ({
	showTabCount: true,
	hidePopupBehavior: "minimize",
	currentWindowLimitRecents: true,
	navigateRecentsWithPopup: false,
}));

vi.mock("@/background/settings", () => ({
	default: {
		get: () => Promise.resolve({ ...storedSettings }),
	},
}));

const {
	OpenPopupCommand,
	PreviousTabCommand,
} = CommandIDs;
const PopupTab = {
	id: 9,
	url: "chrome-extension://quickeyfakeextensionidaaaaaaaaaa/popup.html?props=%7B%7D",
	windowId: 2,
	windowType: "popup",
};
const BrowserTab = { id: 1, url: "https://a.example.com/", windowId: 1 };

let controller;
let popupLink;


async function flush(
	times = 4)
{
	for (let i = 0; i < times; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

	// create a controller in a fresh module graph with the given tabs, the
	// active one listed first, and give it control
async function startController({
	tabs = [{ ...BrowserTab, active: true }],
	popupConnected = false,
	menuConnected = false } = {})
{
	vi.resetModules();
	vi.stubGlobal("chrome", createChromeFake({ tabs }));
	navigator.locks = createLocksFake();

	const control = (await import("@/shared/control")).default;
	const { createController } = await import("@/shared/controller");

	popupLink = {
		isPopupConnected: () => popupConnected,
		isMenuConnected: () => menuConnected,
		notify: vi.fn(() => Promise.resolve(true)),
	};
	controller = createController({ popupLink });
	controller.listen();
	control.claimWhenAvailable(() => {
		controller.start();
	});
	await flush();
}


beforeEach(() => {
	vi.clearAllMocks();
	popupWindow.isVisible = false;
	popupWindow.hideBehavior = "behind";
	toolbarIcon.isNormal = true;
	storedSettings.navigateRecentsWithPopup = false;
});


describe("settings", () => {
	it("applies the stored settings when it takes control", async () => {
		await startController();

		expect(toolbarIcon.showTabCount).toHaveBeenCalledWith(true);
		expect(popupWindow.hideBehavior).toBe("minimize");
		expect(controller.state.currentWindowLimitRecents).toBe(true);
		expect(controller.state.navigateRecentsWithPopup).toBe(false);
	});

	it("applies a changed setting", async () => {
		await startController();
		controller.api.settingChanged({ key: "navigateRecentsWithPopup", value: true });
		controller.api.settingChanged({ key: "hidePopupBehavior", value: "tab" });

		expect(controller.state.navigateRecentsWithPopup).toBe(true);
		expect(popupWindow.hideBehavior).toBe("tab");
	});
});


describe("the open-popup command", () => {
	it("creates the popup window for the active tab when it isn't open", async () => {
		await startController();
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupWindow.create).toHaveBeenCalledTimes(1);
		expect(popupWindow.create.mock.calls[0][0]).toMatchObject({ id: BrowserTab.id });
		expect(controller.api.getActiveTab()).toMatchObject({ id: BrowserTab.id });
		expect(popupLink.notify).not.toHaveBeenCalled();
	});

	it("moves the menu's selection down when the menu is open", async () => {
		await startController({ menuConnected: true });
		popupWindow.isOpen.mockResolvedValueOnce(true);
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupLink.notify).toHaveBeenCalledExactlyOnceWith("modifySelected", { direction: 1 });
		expect(popupWindow.create).not.toHaveBeenCalled();
	});

	it("tells a hidden popup window to show itself over the active tab", async () => {
		await startController({
			tabs: [{ ...BrowserTab, active: true }, PopupTab],
			popupConnected: true,
		});
		popupWindow.isOpen.mockResolvedValueOnce(true);
		chrome.commands.onCommand.dispatch(OpenPopupCommand);
		await flush();

		expect(popupLink.notify).toHaveBeenCalledExactlyOnceWith("showWindow", {
			focusSearch: false,
			activeTab: expect.objectContaining({ id: BrowserTab.id }),
		});
	});
});


describe("the previous-tab command", () => {
	it("switches to the previous tab directly when not navigating with the popup", async () => {
		await startController();
		chrome.commands.onCommand.dispatch(PreviousTabCommand);
		await flush();

		expect(toolbarIcon.invertFor).toHaveBeenCalledTimes(1);
			// the stored setting limits navigation to the current window
		expect(recentTabs.navigate).toHaveBeenCalledExactlyOnceWith(-1, true);
		expect(popupLink.notify).not.toHaveBeenCalled();
	});

	it("moves the open popup's selection when navigating with the popup", async () => {
		storedSettings.navigateRecentsWithPopup = true;
		await startController({ popupConnected: true });
		chrome.commands.onCommand.dispatch(PreviousTabCommand);
		await flush();

		expect(controller.state.navigatingRecents).toBe(true);
		expect(popupLink.notify).toHaveBeenCalledExactlyOnceWith("modifySelected", {
			direction: 1,
			navigatingRecents: true,
		});
		expect(recentTabs.navigate).not.toHaveBeenCalled();
	});
});


describe("the toggle", () => {
	it("tells the popup to stop navigating recents before toggling", async () => {
		await startController({ popupConnected: true });
		controller.state.navigatingRecents = true;
		controller.toggleRecentTabs(true);
		await flush();

		expect(popupLink.notify).toHaveBeenCalledExactlyOnceWith("stopNavigatingRecents");
		expect(controller.state.navigatingRecents).toBe(false);
		expect(recentTabs.toggle).toHaveBeenCalledExactlyOnceWith(true);
	});
});
