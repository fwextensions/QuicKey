import cp from "cp";
import shared from "@/lib/shared";
import storage from "@/background/quickey-storage";
import {HidePopupBehavior, IsFirefox, PopupInnerHeight, PopupInnerWidth, PopupURL} from "@/background/constants";
import {calcBounds} from "@/background/popup-utils";
import {popupEmitter} from "@/background/popup-emitter";


const {Behind, Tab, Minimize} = HidePopupBehavior;


let popupAdjustmentWidth = 0;
let popupAdjustmentHeight = 0;
let isVisible = false;
let isHiddenInTab = false;
let hideBehavior = Behind;
let windowID;
let tabID;
let lastActiveTab;


storage.get(data => ({popupAdjustmentWidth, popupAdjustmentHeight} = data));


async function createPopup(
	options)
{
	const defaultOptions = {
		type: "popup",
		focused: true
	};

	if (!IsFirefox) {
		defaultOptions.setSelfAsOpener = true;
	}

	const window = await cp.windows.create({
		...defaultOptions,
		...options,
	});

	windowID = window.id;
	tabID = window.tabs[0].id;
	popupEmitter.emit("create", { window });

	return window;
}


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


async function create(
	activeTab,
	props = {},
	alignment)
{
		// close any existing window, in case one was still open
	await close();

	const propsJSON = JSON.stringify(props);
		// get the full URL with the extension ID in it so that we can
		// delete it from the history below, which requires an exact match
	const url = `${PopupURL}?${new URLSearchParams({ props: propsJSON })}`;
		// we won't have an activeTab if the user is opening the popup with
		// a devtools window in the foreground
	const targetWindow = activeTab && await cp.windows.get(activeTab.windowId);
	const bounds = calcBounds(
		props.navigatingRecents ? null : targetWindow,
		{
			alignment,
			popupAdjustmentWidth,
			popupAdjustmentHeight
		}
	);
	let window;

	if (hideBehavior !== Tab) {
		window = await createPopup({ url, ...bounds });
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
		bounds.width += widthDelta;
		bounds.height += heightDelta;

			// shift the position by half a negative delta to keep the
			// window centered in the target area
		bounds.left += -Math.floor(widthDelta / 2);
		bounds.top += -Math.floor(heightDelta / 2);

		await cp.windows.update(window.id, bounds);
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
	const bounds = calcBounds(
		targetWindow,
		{
			alignment,
			popupAdjustmentWidth,
			popupAdjustmentHeight
		}
	);
	let window;

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
			await cp.windows.update(windowID, { focused: true, left: bounds.left, top: bounds.top });
		}

			// we seem to have to pass width and height here, even if they
			// haven't changed, to keep the window from shifting size
		window = await cp.windows.update(windowID, { focused: true, ...bounds });
	} else {
			// create a popup window with the tab that's hiding in another
			// window, instead of passing in a URL.  that will move the
			// existing tab into the new popup.
		window = await createPopup({ tabId: tabID, ...bounds });
	}

	lastActiveTab = activeTab;
	isVisible = true;
	isHiddenInTab = false;

	popupEmitter.emit("show", { window });

	return window;
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
		let targetWindow = await getWindow(targetTabOrWindow);

		if (hideBehavior == Behind) {
				// hide the popup behind the focused window.  we have to pass in
				// the adjustment deltas so calcPosition() calculates the position
				// based on the correct size, which may shift slightly on screens
				// with different DPIs.
			const bounds = calcBounds(
				targetWindow,
				{
					popupAdjustmentWidth,
					popupAdjustmentHeight
				}
			);

			Object.assign(options, bounds);

				// we only want to explicitly unfocus the popup if we're hiding
				// it behind the target window.  if it's being minimized,
				// unfocusing it as well can cause window stacking weirdness.
			if (unfocus) {
				options.focused = false;
			}
		} else if (hideBehavior == Minimize) {
			options.state = "minimized";
		}

DEBUG && hideBehavior == Behind && (!Number.isInteger(options.left) || !Number.isInteger(options.top)) && console.error("==== bad popup options", options);

		try {
			const {state} = await cp.windows.update(windowID, options);

			if (hideBehavior == Minimize && state !== "minimized") {
					// for some irritating reason, minimizing the popup after it
					// was blurred because another window was focused doesn't
					// work reliably.  and just trying it again immediately also
					// doesn't work.  waiting even 100ms wasn't reliable, so wait
					// a whole quarter second to minimize it again.  ffs
				setTimeout(() => cp.windows.update(windowID, options), 250);
			}

				// get the target window's current state after updating the popup
			targetWindow = await getWindow(targetTabOrWindow);

			if (unfocus && !targetWindow.focused) {
					// we just unfocused the popup, but the targetWindow
					// didn't become focused, probably because we're on
					// macOS, so force it into focus
				await cp.windows.update(targetWindow.id, { focused: true });
			}

			popupEmitter.emit("hide", { hideBehavior });
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
	popupEmitter.emit("blur", { windowID });
}


async function resize(
	width,
	height)
{
	await cp.windows.update(windowID, { width, height });
}


async function close()
{
		// look for any open popup tabs.  there should only ever be one, but
		// at least one time, two got opened, so get them all to be safe.
	const openTabs = await cp.tabs.query({ url: `${PopupURL}*` });
	const originalWindowID = windowID;

		// set the IDs to 0 before calling remove(), so that if someone
		// calls isOpen() before the tab is fully closed, isOpen will
		// return false
	windowID = 0;
	tabID = 0;
	isVisible = false;

	try {
		await cp.tabs.remove(openTabs.map(({id}) => id));
	} catch (e) {}

	if (originalWindowID) {
			// close() may be called even when there's no open popup, so only
			// dispatch the event if the window was actually open
		popupEmitter.emit("close", { windowID: originalWindowID });
	}
}


export default shared("popupWindow", () => ({
	create,
	show,
	hide,
	blur,
	resize,
	close,

	on(type, callback) {
		popupEmitter.on(type, callback);
	},

	removeListener(type, callback) {
		popupEmitter.removeListener(type, callback);
	},

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
