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
		seedSize: vi.fn(() => Promise.resolve()),
		isOpen: vi.fn(() => Promise.resolve(false)),
		create: vi.fn(() => Promise.resolve({})),
		close: vi.fn(() => Promise.resolve()),
		on: vi.fn(),
		snapshot: vi.fn(() => ({ windowID: 2, tabID: 9, isVisible: true })),
		adopt: vi.fn(),
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

	it("applies the settings it mirrors when they change in storage", async () => {
		await startController();
		await chrome.storage.local.set({ data: { settings: { ...storedSettings } } });
		await flush();
		vi.clearAllMocks();

		await chrome.storage.local.set({
			data: {
				settings: {
					...storedSettings,
					navigateRecentsWithPopup: true,
					hidePopupBehavior: "tab",
				},
			},
		});
		await flush();

		expect(controller.state.navigateRecentsWithPopup).toBe(true);
		expect(popupWindow.hideBehavior).toBe("tab");
			// showTabCount didn't change, so it isn't applied again
		expect(toolbarIcon.showTabCount).not.toHaveBeenCalled();
	});

	it("ignores storage writes that don't change those settings", async () => {
		await startController();
		await chrome.storage.local.set({ data: { settings: { ...storedSettings }, tabIDs: [1] } });
		await flush();
		vi.clearAllMocks();
		popupWindow.hideBehavior = "untouched";

		await chrome.storage.local.set({ data: { settings: { ...storedSettings }, tabIDs: [1, 2] } });
		await chrome.storage.local.set({ lastSavedFrom: "/popup.html" });
		await flush();

		expect(toolbarIcon.showTabCount).not.toHaveBeenCalled();
		expect(popupWindow.hideBehavior).toBe("untouched");
	});
});


describe("handing over control", () => {
	it("snapshots everything but startingUp, and adopts it", async () => {
		await startController();

		controller.state.startingUp = true;
		controller.state.activeTab = { ...BrowserTab };
		controller.state.navigatingRecents = true;

		const snapshot = controller.snapshot();

		expect(snapshot).toEqual({
			state: {
				activeTab: BrowserTab,
				navigatingRecents: true,
				navigateRecentsWithPopup: false,
				currentWindowLimitRecents: true,
			},
			popupWindow: { windowID: 2, tabID: 9, isVisible: true },
		});

		const other = (await import("@/shared/controller")).createController({ popupLink });

		other.adopt(snapshot);

		expect(other.state).toEqual({ ...snapshot.state, startingUp: false });
		expect(popupWindow.adopt).toHaveBeenCalledExactlyOnceWith(snapshot.popupWindow);
	});

	it("yields the lock and takes it again once it's free", async () => {
		vi.resetModules();
		vi.stubGlobal("chrome", createChromeFake({ tabs: [{ ...BrowserTab, active: true }] }));
		navigator.locks = createLocksFake();

		const control = (await import("@/shared/control")).default;
		const { startController } = await import("@/shared/controller");

		controller = startController({ popupLink });
		await flush();

		expect(control.isHeld()).toBe(true);
		expect(controller.yieldControl("test")).toBe(true);

			// the page's request was queued before the yield, so it gets the
			// lock before the controller's new request
		let releasePage;

		navigator.locks.request("__control__", () => new Promise((release) => releasePage = release));
		await flush();

		expect(control.isHeld()).toBe(false);
		expect(controller.yieldControl("again")).toBe(false);

		releasePage();
		await flush();

		expect(control.isHeld()).toBe(true);

			// taking control again doesn't attach the one-time listeners twice
		expect(popupWindow.on).toHaveBeenCalledTimes(1);
		expect(chrome.storage.onChanged.listenerCount()).toBe(1);
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
			// no tab to add in the same task, since the toggle wasn't from a
			// shortcut that passed one
		expect(recentTabs.toggle).toHaveBeenCalledExactlyOnceWith(true, null);
	});
});
