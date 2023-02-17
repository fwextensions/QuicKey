import cp from "cp";
import {PopupInnerWidth, PopupInnerHeight, PopupPadding} from "@/background/constants";

let screens;

cp.system.display.getInfo().then((screenInfo) => {
	screens = screenInfo.map(({ workArea }) => ({
		...workArea,
		right: workArea.left + workArea.width,
		bottom: workArea.top + workArea.height
	}));
});

function getScreen(
	targetWindow)
{
	if (targetWindow && screens.length > 1) {
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
		return {
			left: screen.availLeft || 0,
			top: screen.availTop || 0,
			width: screen.availWidth,
			height: screen.availHeight
		};
	}
}

function getAlignedPosition(
	alignment,
	size,
	start,
	availableSpace,
	padding = 0)
{
	switch (alignment) {
		case "left":
		case "top":
			return start + padding;

		case "center":
			return start + Math.floor((availableSpace - size) / 2);

		case "right":
		case "bottom":
			return start + availableSpace - padding - size;
	}
}

export function calcPosition(
	targetWindow,
	{
		alignment = "center-center",
		popupAdjustmentWidth = 0,
		popupAdjustmentHeight = 0
	} = {})
{
	const width = PopupInnerWidth + popupAdjustmentWidth;
	const height = PopupInnerHeight + popupAdjustmentHeight;
	const [horizontal, vertical] = alignment.split("-");
	const screen = getScreen(targetWindow);
	const { left: targetX, top: targetY, width: targetW, height: targetH } =
		targetWindow || screen;
		// Chrome will throw an error if the popup is more than 50% off-screen,
		// which can happen if the target window has been dragged mostly off-
		// screen.  so clamp the top/left to keep it fully on-screen, with padding.
	const left = Math.max(
		screen.left + PopupPadding,
		Math.min(
			getAlignedPosition(horizontal, width, targetX, targetW, PopupPadding),
			screen.width - width - PopupPadding
		)
	);
	const top = Math.max(
		screen.top + PopupPadding,
		Math.min(
			getAlignedPosition(vertical, height, targetY, targetH, PopupPadding),
			screen.height - height - PopupPadding
		)
	);

	return { left, top, width, height };
}
