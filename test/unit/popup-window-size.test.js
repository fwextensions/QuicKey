import { describe, it, expect, beforeEach, vi } from "vitest";
import { PopupInnerHeight, PopupInnerWidth } from "@/background/constants";

	// create() measures the new popup window's frame (outer size minus the
	// tab's inner size) and stores it as the size adjustment that seeds every
	// later popup.  in 2.5.0 it added each miss to the stored value instead,
	// which drifted whenever the popup had been resized to fit a short list,
	// until popups were sized off the screen ("50% within visible screen
	// space") or below zero ("Value must be at least 0") and failed to open.

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

	// a Windows-like popup frame
const FrameWidth = 16;
const FrameHeight = 39;
const DefaultWidth = PopupInnerWidth + FrameWidth;
const DefaultHeight = PopupInnerHeight + FrameHeight;

let realCreate;
	// returns the inner size the tab reports for a window created with the
	// given createData.  by default, a window gets the size it asked for, less
	// the frame.
let measureTab;

beforeEach(() => {
		// one chrome fake is shared by the whole file, so undo the last test's
		// update spy before adding a fresh one
	vi.restoreAllMocks();
	chrome.storage.local.clear();
	chrome.tabs._seed([{ id: 1, url: "https://a.example.com/", windowId: 1 }]);
	chrome.runtime._setContexts([]);

	realCreate ??= chrome.windows.create;
	measureTab = ({ width, height }) => ({ width: width - FrameWidth, height: height - FrameHeight });
	chrome.windows.create = vi.fn(async (createData) => {
		const window = await realCreate(createData);

		window.tabs = window.tabs.map((tab) => ({ ...tab, ...measureTab(createData) }));

		return window;
	});
	vi.spyOn(chrome.windows, "update");
});

async function loadPopupWindow()
{
	vi.resetModules();

	const { default: popupWindow } = await import("@/background/popup-window");
	const { default: storage } = await import("@/background/quickey-storage");

	return { popupWindow, storage };
}

async function getAdjustment(
	storage)
{
	const { popupAdjustmentWidth, popupAdjustmentHeight } = await storage.get();

	return [popupAdjustmentWidth, popupAdjustmentHeight];
}

async function activeTab()
{
	const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

	return tab;
}

function lastCreateSize()
{
	const { width, height } = chrome.windows.create.mock.lastCall[0];

	return [width, height];
}

function updatesWithNegativeSize()
{
	return chrome.windows.update.mock.calls
		.filter(([, { width, height }]) => width < 0 || height < 0);
}


describe("popup-window create() sizing", () => {
	it("records the measured frame and sizes the window to fit it", async () => {
		const { popupWindow, storage } = await loadPopupWindow();
		const window = await popupWindow.create(await activeTab());

		expect(await getAdjustment(storage)).toEqual([FrameWidth, FrameHeight]);

		const { width, height } = await chrome.windows.get(window.id);

		expect([width, height]).toEqual([DefaultWidth, DefaultHeight]);
	});

		// the field failure: the popup page shrinks the popup to fit a short
		// list, and the next create() starts from that size
	it("keeps the adjustment stable across resize and create cycles", async () => {
		const { popupWindow, storage } = await loadPopupWindow();

		for (let i = 0; i < 5; i++) {
			await popupWindow.create(await activeTab());
			await popupWindow.resize(DefaultWidth, 300);
		}

		await popupWindow.create(await activeTab());

		expect(await getAdjustment(storage)).toEqual([FrameWidth, FrameHeight]);
		expect(updatesWithNegativeSize()).toEqual([]);
	});

		// a tiling window manager forces the window to its own size, so the tab
		// comes back much bigger than the window that was requested
	it("ignores a measurement that can't be the frame", async () => {
		const { popupWindow, storage } = await loadPopupWindow();

		measureTab = () => ({ width: 1500, height: 1000 });

		for (let i = 0; i < 3; i++) {
			await popupWindow.create(await activeTab());
		}

		expect(await getAdjustment(storage)).toEqual([0, 0]);
		expect(updatesWithNegativeSize()).toEqual([]);
		expect(lastCreateSize()).toEqual([PopupInnerWidth, PopupInnerHeight]);
	});

	it("ignores a stored adjustment that's out of range", async () => {
		const first = await loadPopupWindow();

		await first.storage.set(() => ({ popupAdjustmentWidth: -984, popupAdjustmentHeight: 2000 }));

		const { popupWindow, storage } = await loadPopupWindow();

		await popupWindow.create(await activeTab());

			// it started from the default size, not 500 - 984 wide or 2488 tall
		expect(lastCreateSize()).toEqual([PopupInnerWidth, PopupInnerHeight]);
			// and replaced the bad value with the real frame
		expect(await getAdjustment(storage)).toEqual([FrameWidth, FrameHeight]);
	});

	it("doesn't record the frame when resizing to fit it fails", async () => {
		const { popupWindow, storage } = await loadPopupWindow();

		chrome.windows.update.mockRejectedValueOnce(new Error("Invalid value for bounds."));

		await expect(popupWindow.create(await activeTab())).resolves.toBeTruthy();
		expect(await getAdjustment(storage)).toEqual([0, 0]);

			// the next create() still works from the default size
		await popupWindow.create(await activeTab());
		expect(lastCreateSize()).toEqual([PopupInnerWidth, PopupInnerHeight]);
		expect(await getAdjustment(storage)).toEqual([FrameWidth, FrameHeight]);
	});

	it("ignores a resize to a size that isn't positive", async () => {
		const { popupWindow } = await loadPopupWindow();

		await popupWindow.create(await activeTab());

		for (const [width, height] of [[-5, 400], [400, 0], [NaN, 400], [400, Infinity]]) {
			await popupWindow.resize(width, height);
		}

		await popupWindow.create(await activeTab());
		expect(lastCreateSize()).toEqual([DefaultWidth, DefaultHeight]);
	});

	it("throws a clear error when the tab-mode show() gets no window", async () => {
		const { popupWindow } = await loadPopupWindow();

		popupWindow.loadHideBehavior("tab");
			// moving the hidden tab into a popup window fails
		chrome.windows.create = vi.fn(() => Promise.reject(new Error("Value must be at least 0.")));

		await expect(popupWindow.create(await activeTab()))
			.rejects.toThrow("couldn't move the popup tab into a window");
	});
});
