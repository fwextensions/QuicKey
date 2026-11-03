	// the most window chrome we could plausibly see in CSS px.  the real values
	// are around 16 wide and 35-39 tall, so this is loose on purpose -- it only
	// has to be tight enough to catch a measurement taken mid-transition.
const MaxWindowChrome = 100;
	// how many times the popup can resize itself to fit its content without a
	// render or a measurement that already fits.  settling after a scale change
	// takes one or two, so this leaves room for that but stops a real loop quickly.
const MaxFitResizes = 3;


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
		// mid-transition reading is off by hundreds.
	const settled = width >= 0 && width <= MaxWindowChrome
		&& height >= 0 && height <= MaxWindowChrome;

	return {
		settled,
			// with no believable measurement yet, the current one is still the
			// best guess we have
		padding: settled || typeof lastPadding !== "number" ? height : lastPadding,
	};
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
