import { describe, it, expect, vi } from "vitest";

// navigating recents with the popup shows it at the right side of a screen.
// it used to pass no window to calcBounds(), which picks the first screen
// Chrome lists, so with two monitors the popup could open on the one the
// user wasn't looking at.  a "-screen" suffix on the alignment keeps the
// right-center alignment but uses the target window's screen.

const Left = { left: 0, top: 0, width: 1920, height: 1080 };
const Right = { left: 1920, top: 0, width: 2560, height: 1440 };
	// a browser window on the right-hand monitor
const RightWindow = { left: 2200, top: 200, width: 1600, height: 1000 };
const Size = { width: 500, height: 600 };

async function loadCalcBounds()
{
	vi.resetModules();
	globalThis.chrome = {
		...globalThis.chrome,
		system: {
			display: {
				onDisplayChanged: { addListener: vi.fn() },
				getInfo: vi.fn(() => Promise.resolve(
					[Left, Right].map((workArea) => ({ workArea })))),
			},
		},
	};

	const { calcBounds } = await import("@/background/popup-utils");

		// let screen.js's getInfo() promise settle
	await Promise.resolve();
	await Promise.resolve();

	return calcBounds;
}

describe("calcBounds screen alignment", () => {
	it("puts the popup on the target window's screen, not the first one", async () => {
		const calcBounds = await loadCalcBounds();
		const { left, top } = calcBounds(RightWindow,
			{ alignment: "right-center-screen", ...Size });

		expect(left).toBeGreaterThanOrEqual(Right.left);
		expect(left + Size.width).toBeLessThanOrEqual(Right.left + Right.width);
			// centered vertically on the screen, not on the window
		expect(top).toBe(Right.top + Math.floor((Right.height - Size.height) / 2));
	});

	it("aligns to the screen's right edge rather than the window's", async () => {
		const calcBounds = await loadCalcBounds();
		const onScreen = calcBounds(RightWindow,
			{ alignment: "right-center-screen", ...Size });
		const onWindow = calcBounds(RightWindow,
			{ alignment: "right-center", ...Size });

		expect(onScreen.left).toBeGreaterThan(onWindow.left);
	});

	it("still falls back to the first screen with no target window", async () => {
		const calcBounds = await loadCalcBounds();
		const { left } = calcBounds(null,
			{ alignment: "right-center-screen", ...Size });

		expect(left + Size.width).toBeLessThanOrEqual(Left.left + Left.width);
	});
});
