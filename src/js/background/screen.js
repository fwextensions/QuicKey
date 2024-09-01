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

export function getScreenFromWindow(
	targetWindow)
{
	if (targetWindow && screens?.length > 1) {
		const { left, top, width, height } = targetWindow;
		const right = left + width;
		const bottom = top + height;
		let maxOverlapX = 0;
		let maxOverlapY = 0;
		let targetScreen;

		for (const screen of screens) {
			const overlapX = (left < screen.left ? (right - screen.left) : (screen.right - left));
			const overlapY = (top < screen.top ? (bottom - screen.top) : (screen.bottom - top));

			if (overlapX >= maxOverlapX && overlapY >= maxOverlapY) {
				targetScreen = screen;
			}
		}

		return targetScreen;
	} else {
		return screens[0];
	}
}
