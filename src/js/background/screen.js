let screens;

if (chrome.system) {
	chrome.system.display.onDisplayChanged.addListener(updateScreenInfo);

	updateScreenInfo();
}

function updateScreenInfo()
{
	chrome.system.display.getInfo().then((screenInfo) => {
		screens = screenInfo.map(({ workArea }) => ({
			...workArea,
			right: workArea.left + workArea.width,
			bottom: workArea.top + workArea.height
		}));
	});
}

	// treat a window's own bounds as its screen.  used only when
	// chrome.system.display hasn't answered yet: centering the popup on the
	// window is a better guess than a made-up screen, and calcBounds() only
	// needs something with these six properties.
function boundsToScreen(
	{ left, top, width, height })
{
	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height
	};
}

	// last resort, when there's no display info *and* no window to borrow
	// bounds from.  the popup ends up centered in this box, so it just has to
	// be somewhere plausible -- being wrong here is still better than throwing,
	// which takes the popup out entirely.
const DefaultScreen = boundsToScreen({ left: 0, top: 0, width: 1024, height: 768 });

export function getScreenFromWindow(
	targetWindow)
{
		// getInfo() is async and nothing waits for it, so the first calls after
		// a worker start can land before any display info exists.  ask again,
		// in case the first request failed rather than merely being slow.
	if (!screens?.length) {
		chrome.system && updateScreenInfo();

		return targetWindow ? boundsToScreen(targetWindow) : DefaultScreen;
	}

	if (!targetWindow || screens.length === 1) {
		return screens[0];
	}

	const { left, top, width, height } = targetWindow;
	const right = left + width;
	const bottom = top + height;
		// default to the first screen rather than undefined.  this used to
		// return undefined whenever no screen passed the test below, and
		// calcBounds() then threw on screen.left, killing the popup -- seen
		// after a restart restored a window onto coordinates that no longer
		// land on any monitor.
	let bestScreen = screens[0];
	let bestArea = 0;
	let bestDistance = Infinity;

	for (const screen of screens) {
			// the real intersection area, clamped at 0 so a window that misses
			// the screen on one axis doesn't score as overlapping.  the previous
			// version compared against maxOverlapX/maxOverlapY variables that
			// were never assigned, so it wasn't finding the largest overlap at
			// all -- it took the last screen the window wasn't fully clear of.
		const overlapX = Math.max(0,
			Math.min(right, screen.right) - Math.max(left, screen.left));
		const overlapY = Math.max(0,
			Math.min(bottom, screen.bottom) - Math.max(top, screen.top));
		const area = overlapX * overlapY;

		if (area > bestArea) {
			bestArea = area;
			bestScreen = screen;
		} else if (!bestArea) {
				// nothing has overlapped yet, so fall back to whichever screen
				// is nearest center to center.  a window restored onto a monitor
				// that's since been disconnected overlaps nothing at all, and
				// the nearest screen is where the user will go looking for it.
			const dx = (left + width / 2) - (screen.left + screen.width / 2);
			const dy = (top + height / 2) - (screen.top + screen.height / 2);
			const distance = dx * dx + dy * dy;

			if (distance < bestDistance) {
				bestDistance = distance;
				bestScreen = screen;
			}
		}
	}

	return bestScreen;
}
