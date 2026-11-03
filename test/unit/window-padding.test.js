import { describe, it, expect } from "vitest";
import { createFitBudget, getWindowPadding } from "@/popup/window-padding";

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


describe("getWindowPadding", () => {
	it("uses a settled measurement", () => {
		expect(getWindowPadding(Settled, 12)).toEqual({ settled: true, padding: 39 });
	});

	it("rejects the mid-transition measurement that caused the bug", () => {
		const { settled, padding } = getWindowPadding(MidTransition, 39);

		expect(settled).toBe(false);
			// 39, not 329 -- so the window comes out 527 rather than 817
		expect(padding).toBe(39);
	});

		// the chrome really does change a little across a scale change, so the
		// fallback is approximate; it just has to be close, not exact
	it("takes the new measurement once the axes agree again", () => {
		const afterSettling =
			{ outerWidth: 517, outerHeight: 818, innerWidth: 504, innerHeight: 783 };

		expect(getWindowPadding(afterSettling, 39))
			.toEqual({ settled: true, padding: 35 });
	});

		// with nothing cached there's no better option than the live reading
	it("uses the current measurement when there's no cached one", () => {
		expect(getWindowPadding(MidTransition, undefined))
			.toEqual({ settled: false, padding: 329 });
	});

		// outerHeight < innerHeight is the case the old TODO in app.jsx flagged
	it("rejects a negative padding", () => {
		const inverted =
			{ outerWidth: 500, outerHeight: 480, innerWidth: 500, innerHeight: 488 };

		expect(getWindowPadding(inverted, 39)).toEqual({ settled: false, padding: 39 });
	});

	it("accepts chrome at the edge of what's plausible", () => {
		const tall = { outerWidth: 516, outerHeight: 588, innerWidth: 500, innerHeight: 488 };

		expect(getWindowPadding(tall, 39)).toEqual({ settled: true, padding: 100 });
	});

		// the popup opened 17px too tall on the same 2.25x display, because this
		// reading was only slightly off, so the sanity check can't catch it.
		// that's why the resize handler has to check the fit again:
		//
		//   [fit-content] outer: 517x528  inner: 488x476  target: 516x540  windowPadding: 52
		//   [fit-content] outer: 517x540  inner: 504x505  target: 516x523  windowPadding: 35
	it("corrects a plausible mid-transition reading on the next measurement", () => {
		const plausible = { outerWidth: 517, outerHeight: 528, innerWidth: 488, innerHeight: 476 };
		const afterSettling = { outerWidth: 517, outerHeight: 540, innerWidth: 504, innerHeight: 505 };

		expect(getWindowPadding(plausible, 39)).toEqual({ settled: true, padding: 52 });
		expect(getWindowPadding(afterSettling, 52)).toEqual({ settled: true, padding: 35 });
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
