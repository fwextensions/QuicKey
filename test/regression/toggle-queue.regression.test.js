// toggleRecentTabs() chains every press onto lastTogglePromise, and after a
// toggle it waits on addTab.flushOrNext() for the switched-to tab to be
// recorded.  Two ways that chain used to get stuck:
//
// - a toggle that switched nothing (a window with no other recents, with the
//   window limit on) still waited for the next tab activation, so later
//   presses queued up and all fired once the user changed tabs some other way
// - a toggle that threw left the chain rejected, so every later press skipped
//   its handlers and toggle stayed dead until the worker restarted

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	toggle: vi.fn(),
	flush: vi.fn(() => Promise.resolve()),
	flushOrNext: vi.fn(),
	exception: vi.fn(),
}));

vi.mock("@/background/recent-tabs", () => ({
	default: { toggle: mocks.toggle },
}));

vi.mock("@/shared/addTab", () => ({
	createAddTab: () => ({ flush: mocks.flush, flushOrNext: mocks.flushOrNext }),
}));

vi.mock("@/background/toolbar-icon", () => ({
	default: { setNormalIcon: vi.fn(() => Promise.resolve()) },
}));

vi.mock("@/background/popup-window", () => ({
	default: { on: vi.fn(), isOpen: vi.fn(() => Promise.resolve(false)) },
}));

vi.mock("@/background/page-trackers", () => ({
	default: { background: { event: vi.fn(), exception: mocks.exception } },
}));

let toggleRecentTabs;


	// let the queued promise chains run
async function settle()
{
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}


beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.spyOn(console, "error").mockImplementation(() => {});
	const { createController } = await import("@/shared/controller");

	({ toggleRecentTabs } = createController({
		popupLink: {
			isPopupConnected: () => false,
			isMenuConnected: () => false,
			notify: () => Promise.resolve(false),
		},
	}));
});


describe("the toggle queue", () => {
	it("doesn't wait for a tab activation when the toggle switched nothing", async () => {
		mocks.toggle.mockResolvedValue(false);
			// nothing is pending, so a real flushOrNext() would wait forever
		mocks.flushOrNext.mockReturnValue(new Promise(() => {}));

		toggleRecentTabs(true);
		toggleRecentTabs(true);
		toggleRecentTabs(true);
		await settle();

		expect(mocks.toggle).toHaveBeenCalledTimes(3);
		expect(mocks.flushOrNext).not.toHaveBeenCalled();
	});

	it("waits for the activation after a toggle that did switch", async () => {
		mocks.toggle.mockResolvedValue(true);
		mocks.flushOrNext.mockReturnValue(new Promise(() => {}));

		toggleRecentTabs(true);
		toggleRecentTabs(true);
		await settle();

			// the second press has to wait until the first switch is recorded
		expect(mocks.toggle).toHaveBeenCalledTimes(1);
		expect(mocks.flushOrNext).toHaveBeenCalledTimes(1);
	});

	it("keeps working after a toggle throws, and reports the error once", async () => {
		const error = new RangeError("Maximum call stack size exceeded");

		mocks.toggle
			.mockRejectedValueOnce(error)
			.mockResolvedValue(false);

		toggleRecentTabs(true);
		toggleRecentTabs(true);
		toggleRecentTabs(true);
		await settle();

		expect(mocks.toggle).toHaveBeenCalledTimes(3);
		expect(mocks.exception).toHaveBeenCalledExactlyOnceWith(error);
	});
});
