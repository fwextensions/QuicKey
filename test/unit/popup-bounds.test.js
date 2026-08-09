import { describe, it, expect, vi } from "vitest";

	// chrome.windows.create() and .update() reject a bounds value that isn't an
	// integer with "Invalid value for bounds", which showed up in the GA
	// exception report as ~150 events from popup-window.js.  the floats come
	// from fractional display scaling: the popup page measures its own
	// outerWidth/outerHeight (and outerHeight - innerHeight for the frame
	// padding) and hands those to resize(), and chrome.windows reports
	// fractional bounds for the target window on those displays too.

let screen = {
	left: 0,
	top: 0,
	width: 1920,
	height: 1080,
	right: 1920,
	bottom: 1080,
};

vi.mock("@/background/screen", () => ({
	getScreenFromWindow: () => screen,
}));

const { calcBounds } = await import("@/background/popup-utils");

	// a window near the middle of the screen, with the fractional bounds Chrome
	// reports at 150% scaling
const FractionalWindow = {
	left: 320.6666564941406,
	top: 180.3333282470703,
	width: 1280.6666259765625,
	height: 720.3333129882812,
};

function expectAllIntegers(
	bounds)
{
	for (const [key, value] of Object.entries(bounds)) {
		expect(Number.isInteger(value), `${key} is ${value}`).toBe(true);
	}
}

describe("calcBounds", () => {
	it("rounds a fractional size to integers", () => {
		const bounds = calcBounds(null, { width: 500.5, height: 601.3333 });

		expectAllIntegers(bounds);
		expect(bounds.width).toBe(501);
		expect(bounds.height).toBe(601);
	});

	it("rounds the position when the target window is fractional", () => {
		expectAllIntegers(calcBounds(FractionalWindow, {
			width: 500,
			height: 600,
		}));
	});

	it("rounds when both the window and the size are fractional", () => {
		expectAllIntegers(calcBounds(FractionalWindow, {
			width: 500.5,
			height: 601.3333,
		}));
	});

	it("rounds for every alignment", () => {
		for (const horizontal of ["left", "center", "right"]) {
			for (const vertical of ["top", "center", "bottom"]) {
				expectAllIntegers(calcBounds(FractionalWindow, {
					alignment: `${horizontal}-${vertical}`,
					width: 500.5,
					height: 601.3333,
				}));
			}
		}
	});

	it("rounds when the screen work area is fractional", () => {
		const originalScreen = screen;

		screen = {
			left: 0,
			top: 0,
			width: 1707.3333740234375,
			height: 960.6666870117188,
			right: 1707.3333740234375,
			bottom: 960.6666870117188,
		};

		try {
			expectAllIntegers(calcBounds(FractionalWindow, {
				width: 500.5,
				height: 601.3333,
			}));
		} finally {
			screen = originalScreen;
		}
	});

		// the rounding has to leave the off-screen clamp intact -- Chrome also
		// throws if the popup is more than 50% off-screen, which is what the
		// clamp in calcBounds() exists to prevent
	it("still clamps a window dragged off the left edge", () => {
		const { left, top } = calcBounds(
			{ ...FractionalWindow, left: -1100.5, top: -800.25 },
			{ width: 500.5, height: 601.3333 }
		);

		expect(left).toBe(50);
		expect(top).toBe(50);
		expectAllIntegers({ left, top });
	});

	it("still clamps a window dragged off the right edge", () => {
		const bounds = calcBounds(
			{ ...FractionalWindow, left: 3000.5, top: 2000.25 },
			{ width: 500.5, height: 601.3333 }
		);

		expectAllIntegers(bounds);
		expect(bounds.left + bounds.width).toBeLessThanOrEqual(screen.width);
		expect(bounds.top + bounds.height).toBeLessThanOrEqual(screen.height);
	});
});
