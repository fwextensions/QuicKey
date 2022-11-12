import cp from "cp";
import shared from "@/lib/shared";
import storage from "@/background/quickey-storage";
import {PopupURL, HidePopupBehavior} from "@/background/constants";


const {Behind, Tab, Minimize} = HidePopupBehavior;
const PopupInnerWidth = 500;
const PopupInnerHeight = 488;
const PopupPadding = 50;


let popupAdjustmentWidth = 0;
let popupAdjustmentHeight = 0;
let isVisible = false;
let isHiddenInTab = false;
let hideBehavior = Behind;
let windowID;
let tabID;
let lastActiveTab;


storage.get(data => ({popupAdjustmentWidth, popupAdjustmentHeight} = data));


async function getLastWindow()
{
	const windows = await cp.windows.getAll({
		windowTypes: ["normal"],
		populate: true
	});

		// return the last unfocused window, or just the last one, if
		// there's only one open and it's focused
	return windows.filter(({focused, incognito}) => !focused && !incognito).pop()
		|| windows.pop();
}


async function getWindow(
	tabOrWindow)
{
	if (tabOrWindow?.windowId) {
		return await cp.windows.get(tabOrWindow.windowId);
	} else {
		return tabOrWindow;
	}
}


function getScreen()
{
	return {
		left: screen.availLeft || 0,
		top: screen.availTop || 0,
		width: screen.availWidth,
		height: screen.availHeight
	};
}


function getAlignedPosition(
	alignment,
	size,
	start,
	availableSpace,
	padding)
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


function calcPosition(
	targetWindow,
	alignment = "center-center")
{
	const {left: targetX, top: targetY, width: targetW, height: targetH} =
		targetWindow || getScreen();
	const width = PopupInnerWidth + popupAdjustmentWidth;
	const height = PopupInnerHeight + popupAdjustmentHeight;
	const [horizontal, vertical] = alignment.split("-");
	const left = getAlignedPosition(horizontal, width, targetX, targetW, PopupPadding);
	const top = getAlignedPosition(vertical, height, targetY, targetH, PopupPadding);

	return { left, top, width, height };
}


async function create(
	activeTab,
	focusSearch,
	alignment)
{
		// close any existing window, in case one was still open
	await close();

		// get the full URL with the extension ID in it so that we can
		// delete it from the history below, which requires an exact match
	const url = `${PopupURL}?${new URLSearchParams({ focusSearch })}`;
		// we won't have an activeTab if the user is opening the popup with
		// a devtools window in the foreground
	const targetWindow = activeTab && await cp.windows.get(activeTab.windowId);
	let {left, top, width, height} = calcPosition(targetWindow, alignment);
	let window;

	if (hideBehavior !== Tab) {
		window = await cp.windows.create({
			url,
			type: "popup",
			focused: true,
			setSelfAsOpener: true,
			left,
			top,
			width,
			height
		});
		windowID = window.id;
		tabID = window.tabs[0].id;
	} else {
			// first create a tab in the last unfocused window
		const lastWindow = await getLastWindow();
		const tab = await cp.tabs.create({
			url,
			active: false,
			windowId: lastWindow.id,
			index: lastWindow.tabs.length + 1
		});

			// the new tab starts out in a hidden state, by definition
		isHiddenInTab = true;
		tabID = tab.id;

			// calling show() will create a new popup window and move the
			// QuicKey tab to it
		window = await show(activeTab);
	}

	const [popupTab] = window.tabs;
	const {width: innerWidth, height: innerHeight} = popupTab;
	const widthDelta = PopupInnerWidth - innerWidth;
	const heightDelta = PopupInnerHeight - innerHeight;

	if (widthDelta || heightDelta) {
			// the current adjustments weren't enough to hit the target size,
			// so update them with the latest deltas, and then adjust the
			// popup size
		popupAdjustmentWidth += widthDelta;
		popupAdjustmentHeight += heightDelta;
		width += widthDelta;
		height += heightDelta;

			// shift the position by half a negative delta to keep the
			// window centered in the target area
		left += -Math.floor(widthDelta / 2);
		top += -Math.floor(heightDelta / 2);

		await cp.windows.update(window.id, { left, top, width, height });
		await storage.set(() => ({ popupAdjustmentWidth, popupAdjustmentHeight }));
	}

	lastActiveTab = activeTab;
	isVisible = true;

		// after opening the popup, we want to remove its entry from the
		// history, since it's not a real webpage.  doing this in a timeout
		// is kludgy, but the history doesn't seem to have been updated by
		// this point, so wait a second and then delete it.
	setTimeout(() => cp.history.deleteUrl({ url }), 1000);

	return window;
}


async function show(
	activeTab,
	alignment)
{
	const targetWindow = activeTab && await cp.windows.get(activeTab.windowId);
	let {left, top, width, height} = calcPosition(targetWindow, alignment);
	let result;

		// if we're already visible and show() is being called again, that
		// means the user is navigating recent tabs while keeping the popup
		// open, so focus the existing window even if it's in tab mode
	if (isVisible || !isHiddenInTab) {
			// to get a minimized window to change position, we seem to have
			// to make an additional update() call with the position, but
			// only if the window is currently not visible.  otherwise, it
			// won't move back to the focused window after it's shown while
			// navigating recents.
		if (hideBehavior == "minimize" && !isVisible) {
			await cp.windows.update(windowID, { focused: true, left, top });
		}

		result = cp.windows.update(windowID, { focused: true, left, top });
	} else {
			// create a popup window with the tab that's hiding in another
			// window, instead of passing in a URL.  that will move the
			// existing tab into the new popup.
		const window = await cp.windows.create({
			type: "popup",
			tabId: tabID,
			focused: true,
			setSelfAsOpener: true,
			left,
			top,
			width,
			height
		});

		windowID = window.id;

		result = Promise.resolve(window);
	}

	lastActiveTab = activeTab;
	isVisible = true;
	isHiddenInTab = false;

	return result.catch(console.error);
}


async function hideInTab()
{
	const lastWindow = await getLastWindow();

	if (lastWindow) {
		try {
			await cp.tabs.move(tabID, {
				windowId: lastWindow.id,
				index: -1
			});
			isHiddenInTab = true;
		} catch (e) {
			// ignore this error, as it's most likely due to the user
			// switching to the hidden tab and then away, causing it to
			// lose focus, which then calls hide(), but the popup window
			// in which the tab was previously shown is already closed
		}
	} else {
			// there's no window in which to stash the tab, so just
			// close it
		await close();
		isHiddenInTab = false;
	}
}


async function hide(
	unfocus,
	targetTabOrWindow)
{
	isVisible = false;

	if (hideBehavior == Tab || (hideBehavior == Behind && !targetTabOrWindow)) {
			// if we didn't get a target to hide behind, probably because
			// a devtools window got focused, then temporarily fall back to
			// hiding in a tab, so that the popup is no longer visible
		await hideInTab();
	} else {
		const options = {};
		const targetWindow = await getWindow(targetTabOrWindow);

		if (unfocus) {
			options.focused = false;
		}

		if (hideBehavior == Behind) {
				// hide the popup behind the focused window
			const {left, top} = calcPosition(targetWindow);

			options.left = left;
			options.top = top;
		} else if (hideBehavior == Minimize) {
			options.state = "minimized";
		}

		try {
			await cp.windows.update(windowID, options);

			if (unfocus && !targetWindow.focused) {
					// we just unfocused the popup, but the targetWindow
					// didn't become focused, probably because we're on
					// macOS, so force it into focus
				await cp.windows.update(targetWindow.id, { focused: true });
			}
		} catch (e) {
DEBUG && console.error("Failed to hide popup", e);

				// we couldn't move the window for some reason, so close it
			await close();
		}
	}
}


async function blur()
{
	isVisible = false;
	await cp.windows.update(windowID, { focused: false });
}


async function close()
{
		// look for any open popup tabs.  there should only ever be one, but
		// at least one time, two got opened, so get them all to be safe.
	const openTabs = await cp.tabs.query({ url: `${PopupURL}*` });

		// set the IDs to 0 before calling remove(), so that if someone
		// calls isOpen() before the tab is fully closed, isOpen will
		// return false
	windowID = 0;
	tabID = 0;
	isVisible = false;

	try {
		await cp.tabs.remove(openTabs.map(({id}) => id));
	} catch (e) {}
}


export default shared("popupWindow", () => ({
	create,
	show,
	hide,
	blur,
	close,
	get hideBehavior() {
		return hideBehavior;
	},
	set hideBehavior(value) {
		if (hideBehavior !== value) {
			hideBehavior = value;

				// do this after updating hideBehavior, since we're not
				// awaiting the call
			close();
		}
	},
	get id() {
		return windowID;
	},
	get isOpen() {
		return chrome.extension.getViews({ tabId: tabID }).length > 0;
	},
	get isVisible() {
		return isVisible;
	},
	get activeTab() {
		return lastActiveTab;
	}
}));
