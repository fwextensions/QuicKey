import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetContexts, createContext } from "../support/context";

	// browser tab activity flowing through the whole real pipeline: the
	// stateful chrome fake fires the events, controlledEvent gates them on
	// control, tabEventHandlers reacts, addTab debounces by the dwell time,
	// and recent-tabs persists the MRU order through quickey-storage.  the
	// assertions read the MRU list straight out of chrome.storage.local, so
	// a regression anywhere along that chain shows up here.

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
		setColorScheme: vi.fn(() => Promise.resolve()),
		setNormalIcon: vi.fn(() => Promise.resolve()),
		invertFor: vi.fn(() => Promise.resolve()),
		showTabCount: vi.fn(() => Promise.resolve()),
		updateTabCount: vi.fn(() => Promise.resolve()),
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

	// MinTabDwellTime is 1250 and the tab-removed debounce is 1000; one
	// generous step fires either
const Dwell = 1500;

	// settle pending promise chains and any timers due within ms
function flush(
	ms = 0)
{
	return vi.advanceTimersByTimeAsync(ms);
}

async function mruTabIDs()
{
	const { data } = await chrome.storage.local.get("data");

	return data.tabIDs;
}


beforeEach(async () => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	resetContexts({
		tabs: [
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
			{ id: 2, url: "https://b.example.com/", windowId: 1 },
			{ id: 3, url: "https://c.example.com/", windowId: 1 },
			{ id: 4, url: "https://d.example.com/", windowId: 2 },
		],
	});

	await createContext("/background.html", async () => {
		const initEventController = (await import("@/shared/eventController")).default;

		initEventController({ sendPopupMessage: vi.fn(), ports: {} });
	});

	await flush();
});

afterEach(() => {
	vi.useRealTimers();
});


describe("tab activity drives the persisted MRU order", () => {
	it("seeds the current active tab on first run", async () => {
		expect(await mruTabIDs()).toEqual([1]);
	});

	it("records activated tabs after the dwell time", async () => {
		await chrome.tabs.update(2, { active: true });
		await flush(Dwell);
		await chrome.tabs.update(3, { active: true });
		await flush(Dwell);

		expect(await mruTabIDs()).toEqual([1, 2, 3]);
	});

	it("collapses rapid switching, recording only the tab the user settles on", async () => {
		await chrome.tabs.update(2, { active: true });
		await flush(Dwell);
		await chrome.tabs.update(3, { active: true });
		await flush(Dwell);

			// flip through 1 and land on 2 within one dwell period: only 2 may
			// enter the MRU list, else double-pressing the shortcut would bounce
			// between the flipped-through tabs instead of the settled-on ones
		await chrome.tabs.update(1, { active: true });
		await flush(100);
		await chrome.tabs.update(2, { active: true });
		await flush(Dwell);

		expect(await mruTabIDs()).toEqual([1, 3, 2]);
	});

	it("drops closed tabs from the MRU list after the removal debounce", async () => {
		await chrome.tabs.update(2, { active: true });
		await flush(Dwell);
		await chrome.tabs.update(3, { active: true });
		await flush(Dwell);

			// close a background tab; the handler waits out its shutdown
			// debounce before pruning
		await chrome.tabs.remove(2);
		await flush(Dwell);

		expect(await mruTabIDs()).toEqual([1, 3]);
	});

	it("re-keys a tab when Chrome replaces it, keeping its place in the order", async () => {
		await chrome.tabs.update(2, { active: true });
		await flush(Dwell);

			// e.g. a prerendered page swaps in: (addedTabId, removedTabId)
		chrome.tabs.onReplaced.dispatch(200, 2);
		await flush();

		expect(await mruTabIDs()).toEqual([1, 200]);
	});

	it("records the active tab of a window when focus switches to it", async () => {
		await chrome.windows.update(2, { focused: true });
		await flush(Dwell);

		expect(await mruTabIDs()).toEqual([1, 4]);
	});
});
