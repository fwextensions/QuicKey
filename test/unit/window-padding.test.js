import { describe, it, expect } from "vitest";
import { createFitBudget, getFitWidth, getWindowPadding } from "@/popup/window-padding";

// Moving the popup from two 1440p monitors to a 2.25x laptop display left it
// tall enough to run off the bottom of the screen, and it stayed that way until
// typing in the search box triggered another render.  From the log:
//
//   [dpi-change]  dpr: 2.25  outer: 517x528  inner: 217x199  was dpr: 1
//   [fit-content] dpr: 2.25  outer: 517x528  inner: 217x199  windowPadding: 329
//   popup resize: 516x817
//
// outerHeight was still the 1x value while innerHeight had already become the
// 2.25x one (488 / 2.25 ~ 217), so their difference wasn't the window chrome --
// it was the gap between two coordinate spaces.  488 + 329 = 817.

	// what the popup reports once a display change has settled
const Settled = { outerWidth: 516, outerHeight: 527, innerWidth: 500, innerHeight: 488 };
	// ...and what it reported mid-transition
const MidTransition = { outerWidth: 517, outerHeight: 528, innerWidth: 217, innerHeight: 199 };
const LastPadding = { width: 16, height: 39 };


describe("getWindowPadding", () => {
	it("uses a settled measurement", () => {
		expect(getWindowPadding(Settled, { width: 1, height: 12 }))
			.toEqual({ settled: true, width: 16, height: 39 });
	});

	it("rejects the mid-transition measurement that caused the bug", () => {
		const { settled, width, height } = getWindowPadding(MidTransition, LastPadding);

		expect(settled).toBe(false);
			// 39, not 329 -- so the window comes out 527 rather than 817
		expect(height).toBe(39);
			// 16, not 300 -- the width would have been just as wrong
		expect(width).toBe(16);
	});

		// the chrome really does change a little across a scale change, so the
		// fallback is approximate; it just has to be close, not exact
	it("takes the new measurement once the axes agree again", () => {
		const afterSettling =
			{ outerWidth: 517, outerHeight: 818, innerWidth: 504, innerHeight: 783 };

		expect(getWindowPadding(afterSettling, LastPadding))
			.toEqual({ settled: true, width: 13, height: 35 });
	});

		// with nothing cached there's no better option than the live reading
	it("uses the current measurement when there's no cached one", () => {
		expect(getWindowPadding(MidTransition, undefined))
			.toEqual({ settled: false, width: 300, height: 329 });
	});

		// outerHeight < innerHeight is the case the old TODO in app.jsx flagged
	it("rejects a negative padding", () => {
		const inverted =
			{ outerWidth: 500, outerHeight: 480, innerWidth: 500, innerHeight: 488 };

		expect(getWindowPadding(inverted, LastPadding))
			.toEqual({ settled: false, width: 16, height: 39 });
	});

	it("accepts chrome at the edge of what's plausible", () => {
		const tall = { outerWidth: 516, outerHeight: 588, innerWidth: 500, innerHeight: 488 };

		expect(getWindowPadding(tall, LastPadding))
			.toEqual({ settled: true, width: 16, height: 100 });
	});

		// the popup opened 16px too wide and 17px too tall on the same 2.25x
		// display, because these readings were only a little off.  the height
		// looks believable, so it takes the width to reject them:
		//
		//   [fit-content] outer: 516x528  inner: 488x476  target: 528x540  windowPadding: 28x52
		//   [fit-content] outer: 528x540  inner: 516x505  target: 512x523  windowPadding: 12x35
	it("rejects a mid-transition reading that's only a little off", () => {
		const plausible = { outerWidth: 516, outerHeight: 528, innerWidth: 488, innerHeight: 476 };
		const afterSettling = { outerWidth: 528, outerHeight: 540, innerWidth: 516, innerHeight: 505 };

		expect(getWindowPadding(plausible, LastPadding))
			.toEqual({ settled: false, width: 16, height: 39 });
		expect(getWindowPadding(afterSettling, LastPadding))
			.toEqual({ settled: true, width: 12, height: 35 });
	});

	it("accepts chrome width at the edge of what's plausible, but no wider", () => {
		const edge = { outerWidth: 524, outerHeight: 527, innerWidth: 500, innerHeight: 488 };
		const tooWide = { ...edge, outerWidth: 525 };

		expect(getWindowPadding(edge, LastPadding))
			.toEqual({ settled: true, width: 24, height: 39 });
		expect(getWindowPadding(tooWide, LastPadding))
			.toEqual({ settled: false, width: 16, height: 39 });
	});
});


	// the same window has to be different widths on different displays.  from the
	// log and from measuring screenshots:
	//
	//   dpr: 1     outer: 512  inner: 496   clips 4px of the 500px body
	//   dpr: 2.25  outer: 516  inner: 504   leaves 4px extra on the right
describe("getFitWidth", () => {
	const fit = (innerWidth, paddingWidth, currentWidth) =>
		getFitWidth({ innerWidth, contentWidth: 500, paddingWidth, currentWidth });


	it("widens a window that's clipping the body", () => {
		expect(fit(496, 16, 512)).toBe(516);
	});

	it("narrows a window that's wider than the body", () => {
		expect(fit(504, 12, 515)).toBe(512);
	});

	it("keeps the current width when the body fits", () => {
		expect(fit(500, 12, 512)).toBe(512);
	});

		// 500.8 reports as 501 at 2.25x, and that's as close as the window gets
	it("ignores a difference that's just rounding", () => {
		expect(fit(501, 13, 513)).toBe(513);
		expect(fit(499, 13, 513)).toBe(513);
	});
});


describe("createFitBudget", () => {
	function spendUntilEmpty(
		budget)
	{
		let resizes = 0;

			// the limit on this loop is just so a broken budget fails the test
			// instead of hanging it
		while (resizes < 100 && budget.spend()) {
			resizes++;
		}

		return resizes;
	}


	it("stops a resize loop", () => {
		expect(spendUntilEmpty(createFitBudget(3))).toBe(3);
	});

	it("allows enough resizes to settle after a scale change", () => {
		expect(spendUntilEmpty(createFitBudget())).toBeGreaterThanOrEqual(2);
	});

	it("stays empty until it's reset", () => {
		const budget = createFitBudget(1);

		expect(budget.spend()).toBe(true);
		expect(budget.spend()).toBe(false);
		expect(budget.spend()).toBe(false);

		budget.reset();

		expect(budget.spend()).toBe(true);
	});
});
