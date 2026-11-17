import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

	// the toolbar badge: how the open-tab count gets rendered, and -- mostly --
	// when it doesn't.  updateTabCount() is called once per tabs.onCreated /
	// tabs.onRemoved, so closing a window drives it once per tab in that
	// window, and a browser shutdown drives it once per tab that's open.  the
	// count itself has to stay exact through all of that while the writes to
	// chrome.action get coalesced.

const BadgeWriteDelay = 50;

let toolbarIcon;
let setBadgeText;
let setTitle;
let setIcon;
let fetchImage;


	// let the debounced write fire
function flushBadge()
{
	return vi.advanceTimersByTimeAsync(BadgeWriteDelay);
}


	// the image-decoding path setIcon() takes: none of fetch/createImageBitmap/
	// OffscreenCanvas exist in the node test environment, so stand in for them
	// with something that just records which icon was asked for
function stubImageDecoding()
{
	fetchImage = vi.fn(async (url) => ({ blob: async () => ({ url }) }));

	vi.stubGlobal("fetch", fetchImage);
	vi.stubGlobal("createImageBitmap", async ({ url }) => ({
		width: 16,
		height: 16,
		url,
	}));
	vi.stubGlobal("OffscreenCanvas", class {
		getContext() {
			return {
				drawImage: (bitmap) => (this.url = bitmap.url),
				getImageData: () => ({ decodedFrom: this.url }),
			};
		}
	});
}


beforeEach(async () => {
	vi.useFakeTimers();
	vi.resetModules();
	stubImageDecoding();

	toolbarIcon = (await import("@/background/toolbar-icon")).default;

	setBadgeText = vi.spyOn(chrome.action, "setBadgeText");
	setTitle = vi.spyOn(chrome.action, "setTitle");
	setIcon = vi.spyOn(chrome.action, "setIcon");
});

afterEach(() => {
	vi.useRealTimers();
		// no unstubAllGlobals(): setup.js installs chrome/navigator/location the
		// same way, and clearing those breaks every module that reads them
	vi.restoreAllMocks();
});


describe("toolbar icon tab count", () => {
	it("doesn't touch chrome.action while the count is hidden", async () => {
		toolbarIcon.updateTabCount(1);
		toolbarIcon.updateTabCount(-1);

		await flushBadge();

		expect(setBadgeText).not.toHaveBeenCalled();
		expect(setTitle).not.toHaveBeenCalled();
	});

		// the point of the debounce: Chrome fires tabs.onRemoved for every tab
		// in a closing window, and every one of those calls throws during a
		// browser shutdown
	it("coalesces a burst of updates into a single write", async () => {
		chrome.tabs._seed(
			Array.from({ length: 20 }, (_, i) => ({
				id: i + 1,
				url: `https://t${i}.example.com/`,
				windowId: 1,
			}))
		);

		await toolbarIcon.showTabCount(true);

		setBadgeText.mockClear();
		setTitle.mockClear();

			// a 20-tab window closing
		for (let i = 0; i < 20; i++) {
			toolbarIcon.updateTabCount(-1);
		}

		await flushBadge();

		expect(setBadgeText).toHaveBeenCalledTimes(1);
		expect(setTitle).toHaveBeenCalledTimes(1);
			// and the count is the total of every delta, not just the last one
		expect(setBadgeText).toHaveBeenCalledWith({ text: "0" });
	});

	it("keeps the running count exact across coalesced updates", async () => {
		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1 },
			{ id: 2, url: "https://b.example.com/", windowId: 1 },
		]);

		await toolbarIcon.showTabCount(true);
		setBadgeText.mockClear();

		toolbarIcon.updateTabCount(1);
		toolbarIcon.updateTabCount(1);
		toolbarIcon.updateTabCount(-1);
		toolbarIcon.updateTabCount(1);

		await flushBadge();

		expect(setBadgeText).toHaveBeenCalledTimes(1);
		expect(setBadgeText).toHaveBeenCalledWith({ text: "4" });
	});

	it("renders the count immediately when the setting is turned on", async () => {
		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1 },
			{ id: 2, url: "https://b.example.com/", windowId: 1 },
		]);

			// no flushBadge(): showTabCount() has to write without waiting for
			// the debounce, since the user just toggled the setting
		await toolbarIcon.showTabCount(true);

		expect(setBadgeText).toHaveBeenCalledWith({ text: "2" });
	});

		// nothing calls updateTabCount() after the setting goes off, so if
		// showTabCount() doesn't clear the badge itself, the last count stays
		// stuck on the toolbar
	it("clears the badge once when the setting is turned off", async () => {
		chrome.tabs._seed([{ id: 1, url: "https://a.example.com/", windowId: 1 }]);

		await toolbarIcon.showTabCount(true);

		setBadgeText.mockClear();
		setTitle.mockClear();

		await toolbarIcon.showTabCount(false);

		expect(setBadgeText).toHaveBeenCalledTimes(1);
		expect(setBadgeText).toHaveBeenCalledWith({ text: "" });
		expect(setTitle).toHaveBeenCalledWith({ title: "QuicKey" });
	});

		// once it's been cleared, the tab events that keep arriving mustn't
		// each pay for another pointless pair of chrome.action calls
	it("doesn't re-clear the badge on later updates", async () => {
		chrome.tabs._seed([{ id: 1, url: "https://a.example.com/", windowId: 1 }]);

		await toolbarIcon.showTabCount(true);
		await toolbarIcon.showTabCount(false);

		setBadgeText.mockClear();
		setTitle.mockClear();

		toolbarIcon.updateTabCount(1);
		toolbarIcon.updateTabCount(-1);

		await flushBadge();

		expect(setBadgeText).not.toHaveBeenCalled();
		expect(setTitle).not.toHaveBeenCalled();
	});

		// the count drifts while it's hidden, since the events keep firing and
		// nothing renders them, so turning it back on has to requery
	it("resyncs the count from the open tabs when turned back on", async () => {
		chrome.tabs._seed([{ id: 1, url: "https://a.example.com/", windowId: 1 }]);

		await toolbarIcon.showTabCount(true);
		await toolbarIcon.showTabCount(false);

			// tabs opened and closed while the badge was hidden, leaving
			// tabCount out of step with reality
		toolbarIcon.updateTabCount(5);
		await flushBadge();

		chrome.tabs._seed([
			{ id: 1, url: "https://a.example.com/", windowId: 1 },
			{ id: 2, url: "https://b.example.com/", windowId: 1 },
			{ id: 3, url: "https://c.example.com/", windowId: 1 },
		]);

		setBadgeText.mockClear();

		await toolbarIcon.showTabCount(true);

		expect(setBadgeText).toHaveBeenCalledWith({ text: "3" });
	});

		// a failed write has to leave isBadgeShown alone, or the badge stays
		// stuck showing a count the user turned off
	it("still clears the badge if the first attempt failed", async () => {
		chrome.tabs._seed([{ id: 1, url: "https://a.example.com/", windowId: 1 }]);

		await toolbarIcon.showTabCount(true);

		setBadgeText.mockRejectedValueOnce(new Error("The browser is shutting down."));

			// the clear throws, so nothing was actually cleared
		await toolbarIcon.showTabCount(false);

		setBadgeText.mockClear();

			// turning it on and off again gets another attempt, rather than
			// deciding the badge is already clear
		await toolbarIcon.showTabCount(true);
		await toolbarIcon.showTabCount(false);

		expect(setBadgeText).toHaveBeenLastCalledWith({ text: "" });
	});
});


	// setIcon() fetches the PNG itself when given a path, and that fetch is
	// what fails with "Failed to set icon ...: Failed to fetch".  we decode the
	// images once and pass the pixels instead, so nothing is fetched at the
	// moment the icon changes.
describe("toolbar icon images", () => {
	it("passes decoded pixels rather than paths", async () => {
		await toolbarIcon.setNormalIcon();

		const [arg] = setIcon.mock.calls[0];

		expect(arg).toHaveProperty("imageData");
		expect(arg).not.toHaveProperty("path");
			// one per size in the set
		expect(Object.keys(arg.imageData)).toEqual(["16", "19", "24", "32", "38"]);
	});

	it("decodes each icon set only once", async () => {
		await toolbarIcon.setNormalIcon();

		const afterFirst = fetchImage.mock.calls.length;

		await toolbarIcon.setNormalIcon();
		await toolbarIcon.setNormalIcon();

		expect(afterFirst).toBe(5);
		expect(fetchImage).toHaveBeenCalledTimes(afterFirst);
	});

	it("decodes the inverted set separately from the normal one", async () => {
		await toolbarIcon.setNormalIcon();
		await toolbarIcon.invertFor();

		const normal = setIcon.mock.calls[0][0].imageData;
		const inverted = setIcon.mock.calls[1][0].imageData;

		expect(normal[16]).not.toEqual(inverted[16]);
		expect(inverted[16].decodedFrom).toContain("icon-16-inverted.png");
	});

		// a decode that fails shouldn't leave the toolbar with no icon at all,
		// so fall back to what we did before and let setIcon fetch the paths
	it("falls back to paths when the images can't be decoded", async () => {
		fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));

		await toolbarIcon.setNormalIcon();

		const [arg] = setIcon.mock.calls[0];

		expect(arg).toHaveProperty("path");
		expect(arg.path[16]).toBe("/img/icon-16.png");
	});

		// ...and shouldn't then refetch five images on every icon update for
		// the life of the worker
	it("doesn't retry a failed decode on every update", async () => {
		fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));

		await toolbarIcon.setNormalIcon();

		const afterFirst = fetchImage.mock.calls.length;

		await toolbarIcon.setNormalIcon();

		expect(fetchImage).toHaveBeenCalledTimes(afterFirst);
	});
});
