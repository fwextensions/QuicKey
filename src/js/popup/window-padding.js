	// the most window chrome we could plausibly see in CSS px.  the real values
	// are 12-16 wide and 35-39 tall.  the height limit is loose on purpose, but
	// the width has to be tight, since a mid-transition reading can be only a
	// little off: 28 wide by 52 tall made the popup 16px too wide and 17px too
	// tall until the next measurement.
const MaxChromeWidth = 24;
const MaxChromeHeight = 100;
	// how many times the popup can resize itself to fit its content without a
	// render or a measurement that already fits.  settling after a scale change
	// takes one or two, so this leaves room for that but stops a real loop quickly.
const MaxFitResizes = 3;
	// how far the inner width can be from the content width and still count as
	// fitting.  innerWidth is rounded, so 500.8 on a fractional scale factor
	// reports as 501, which isn't worth moving the window for.
const MaxWidthDifference = 1;


	// the difference between the outer and inner window size is the chrome, and
	// the popup needs it to turn a content height into a window height.  but
	// outerWidth/outerHeight and innerWidth/innerHeight don't update in the same
	// frame when the window moves to a display with a different scale factor, so
	// they're briefly reported in different coordinate spaces and subtracting
	// one from the other is meaningless.  moving from 1x to 2.25x produced
	// outer 517x528 against inner 217x199 -- chrome 300 wide and 329 tall --
	// which made the popup 817px, well off the bottom of the screen, and it
	// stayed there until something happened to trigger another render.
	//
	// so check the measurement before believing it, and fall back to the last
	// one that made sense.  the chrome does change slightly across a scale
	// change (39 -> 35 in the case above), so the fallback can be a few px off,
	// but it self-corrects on the next settled measurement.
export function getWindowPadding(
	{ outerWidth, outerHeight, innerWidth, innerHeight },
	lastPadding)
{
	const width = outerWidth - innerWidth;
	const height = outerHeight - innerHeight;
		// both axes have to look sane.  the width is the more reliable tell,
		// since horizontal chrome is only a few px and stays that way, while a
		// mid-transition reading is off by at least a dozen.
	const settled = width >= 0 && width <= MaxChromeWidth
		&& height >= 0 && height <= MaxChromeHeight;

		// with no believable measurement yet, the current one is still the best
		// guess we have
	return settled || !lastPadding
		? { settled, width, height }
		: { settled, ...lastPadding };
}


	// the horizontal chrome changes with the scale factor (16 at 1x, 12 at 2.25x),
	// so a window width that puts the 500px body exactly in the window on one
	// display can clip it or leave a gap on the next one.  returns the width the
	// window should have, which is the current one if the content already fits.
export function getFitWidth(
	{ innerWidth, contentWidth, paddingWidth, currentWidth })
{
	return Math.abs(innerWidth - contentWidth) > MaxWidthDifference
		? contentWidth + paddingWidth
		: currentWidth;
}


	// fitting the window to its content causes a resize event, and the resize
	// handler fits the window again, so a measurement that never lands on the
	// content height, like one that alternates between two values on a fractional
	// scale factor, would keep the window resizing forever.  this caps how many
	// of those fits can happen in a row.
export function createFitBudget(
	maxResizes = MaxFitResizes)
{
	let used = 0;

	return {
		spend()
		{
			if (used < maxResizes) {
				used++;

				return true;
			}

			return false;
		},

		reset()
		{
			used = 0;
		}
	};
}
