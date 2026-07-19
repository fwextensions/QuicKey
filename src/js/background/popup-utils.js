import { PopupPadding, PopupURL } from "@/background/constants";
import { getScreenFromWindow } from "@/background/screen";

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

export function calcBounds(
	targetWindow,
	{
		alignment = "center-center",
		width,
		height,
	} = {})
{
	const [horizontal, vertical] = alignment.split("-");
	const screen = getScreenFromWindow(targetWindow);
	const {
		left: targetX,
		top: targetY,
		width: targetW,
		height: targetH
	} = targetWindow || screen;
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

	// get the URL from either a tab object or what's returned from getContexts()
export function isPopupWindow(
	tab)
{
	return (tab?.url || tab?.documentUrl)?.startsWith(PopupURL);
}

	// the menu holds this web lock for as long as it's open.  it's acquired
	// in popup/init.js, which must use the same literal name.  we use a lock
	// instead of getContexts() because getContexts() can keep returning a
	// stale POPUP context after the menu has closed, whereas the browser
	// releases a lock the instant its page dies, even if the page is frozen.
export const MenuOpenLockName = "__menu-open__";

	// the menu on the toolbar icon is the only context that holds the lock,
	// so a held lock with that name means the menu is currently open.  this
	// is true regardless of whether the background or the popup window
	// currently has control, unlike tracking the menu's port connections.
export async function isMenuOpen()
{
	const { held } = await navigator.locks.query();

	return held.some(({ name }) => name === MenuOpenLockName);
}

	// resolves the next time the menu is closed (immediately if it's not
	// open).  a queued request on the menu's lock is granted as soon as the
	// menu page releases it by going away.
export function whenMenuClosed()
{
	return navigator.locks.request(MenuOpenLockName, () => {});
}
