import storage from "@/background/quickey-storage";
import {HidePopupBehavior, IsFirefox, PopupInnerHeight, PopupInnerWidth, PopupURL} from "@/background/constants";
import {calcBounds} from "@/background/popup-utils";
import {popupEmitter} from "@/background/popup-emitter";
import {connect} from "@/lib/ipc";


const {Behind, Tab, Minimize} = HidePopupBehavior;

	// the storage key under which we persist the popup's window and tab IDs.
	// this lives outside the versioned quickey-storage data blob, since it's
	// transient bookkeeping rather than user data.
const LastPopupIDsKey = "lastPopupIDs";
	// when the extension is reloaded, Chrome navigates any tab that was
	// showing one of its pages to the new tab page, so an orphaned popup can
	// end up on one of these URLs instead of popup.html
const OrphanedTabURLs = [
	"chrome://newtab/",
	"edge://newtab/",
	"about:newtab",
	"about:blank",
];


const { receive } = connect("popup-window");
let popupAdjustmentWidth = 0;
let popupAdjustmentHeight = 0;
let currentWidth = PopupInnerWidth;
let currentHeight = PopupInnerHeight;
let isVisible = false;
let isHiddenInTab = false;
let hideBehavior = Behind;
let { windowID, tabID } = await getExistingPopupID();
let lastActiveTab;


await storage.get((data = {}) => {
	({ popupAdjustmentWidth = 0, popupAdjustmentHeight = 0 } = data);
	currentWidth = PopupInnerWidth + popupAdjustmentWidth;
	currentHeight = PopupInnerHeight + popupAdjustmentHeight;
});
await closeOrphanedPopup();


function saveLastPopupIDs()
{
	return chrome.storage.local.set({ [LastPopupIDsKey]: { windowID, tabID } });
}


function isOrphanedTab(
	{url = ""})
{
	return url.startsWith(PopupURL) || OrphanedTabURLs.includes(url);
}


	// when the extension is reloaded or updated while the popup exists, the
	// popup page's context is destroyed and its tab gets navigated to the new
	// tab page, so the new instance can't find it through getContexts() or a
	// popup.html URL query, and the empty window would be left stranded.  we
	// persist the popup's window and tab IDs whenever they change, so that on
	// startup we can close whatever those IDs still point to.
async function closeOrphanedPopup()
{
	const { [LastPopupIDsKey]: lastIDs } = await chrome.storage.local.get(LastPopupIDsKey);
	const { windowID: lastWindowID = 0, tabID: lastTabID = 0 } = lastIDs ?? {};
	const orphanedTabIDs = new Set();

	if (!lastWindowID && !lastTabID) {
		return;
	}

	if ((lastWindowID && lastWindowID === windowID)
			|| (lastTabID && lastTabID === tabID)) {
			// the stored IDs point to the live popup that getExistingPopupID()
			// just found, which means only the service worker restarted, so
			// there's nothing to clean up
		return;
	}

	if (lastWindowID) {
		try {
			const {type} = await chrome.windows.get(lastWindowID);
			const tabs = await chrome.tabs.query({ windowId: lastWindowID });

				// only close the window if it's a popup and every tab in it
				// looks orphaned, so that a recycled window ID after a browser
				// restart can't take out a window the user cares about
			if (type === "popup" && tabs.every(isOrphanedTab)) {
				tabs.forEach(({id}) => orphanedTabIDs.add(id));
			}
		} catch (e) {}
	}

	if (lastTabID && !orphanedTabIDs.has(lastTabID)) {
		try {
				// the popup may have been hiding as a tab in a normal window
				// when the extension was reloaded
			const tab = await chrome.tabs.get(lastTabID);

			if (isOrphanedTab(tab)) {
				orphanedTabIDs.add(tab.id);
			}
		} catch (e) {}
	}

		// windowID and tabID are normally 0 here, so this clears the stale IDs
	await saveLastPopupIDs();

	if (orphanedTabIDs.size) {
		try {
			await chrome.tabs.remove([...orphanedTabIDs]);
		} catch (e) {}
	}
}


async function getWindow(
	tabOrWindow)
{
	let result = tabOrWindow;

	if (tabOrWindow?.windowId) {
		try {
				// windows.get() throws if the ID doesn't exist
			result = await chrome.windows.get(tabOrWindow.windowId);
		} catch (e) {}
	}

	return result;
}


async function getLastWindow()
{
	const windows = await chrome.windows.getAll({
		windowTypes: ["normal"],
		populate: true
	});

		// return the last unfocused window, or just the last one, if
		// there's only one open and it's focused
	return windows.filter(({focused, incognito}) => !focused && !incognito).pop()
		|| windows.pop();
}


async function getExistingPopupID()
{
	const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
	const [popup] = contexts.filter(({ documentUrl }) => documentUrl.includes("popup.html"));
	let tabID = 0;
	let windowID = 0;

	if (popup) {
			// to check the type of the window containing the popup tab, we have
			// to get the actual window, since the window type is not returned
			// in the response from getContexts()
		const popupWindow = await getWindow(popup);

		tabID = popup.tabId;
		windowID = popup.windowId;

		if (popupWindow.type !== "popup") {
				// this means the popup was hidden in a tab, rather than hiding
				// behind the focused window in its own popup window.  so when
				// show() is called, it'll need to create a new popup window in
				// which to display the popup tab.
			isHiddenInTab = true;
			windowID = 0;
		}
	}

	return { tabID, windowID };
}


async function createPopup(
	options)
{
	const defaultOptions = {
		type: "popup",
		focused: true
	};

	const window = await chrome.windows.create({
		...defaultOptions,
		...options,
	});

	windowID = window.id;
	tabID = window.tabs[0].id;
	await saveLastPopupIDs();
	popupEmitter.emit("create", { window });

	return window;
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
	const targetWindow = await getWindow(activeTab);
	const bounds = calcBounds(
		props.navigatingRecents ? null : targetWindow,
		{
			alignment,
			width: currentWidth,
			height: currentHeight,
		}
	);
	let window;

	if (hideBehavior !== Tab) {
		window = await createPopup({ url, ...bounds });
	} else {
			// first create a tab in the last unfocused window
		const lastWindow = await getLastWindow();
		const tab = await chrome.tabs.create({
			url,
			active: false,
			windowId: lastWindow.id,
			index: lastWindow.tabs.length + 1
		});

			// the new tab starts out in a hidden state, by definition
		isHiddenInTab = true;
		tabID = tab.id;
		await saveLastPopupIDs();

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
		currentWidth = bounds.width;
		currentHeight = bounds.height;

			// shift the position by half a negative delta to keep the
			// window centered in the target area
		bounds.left += -Math.floor(widthDelta / 2);
		bounds.top += -Math.floor(heightDelta / 2);

		await chrome.windows.update(window.id, bounds);
		await storage.set(() => ({ popupAdjustmentWidth, popupAdjustmentHeight }));
	}

	lastActiveTab = activeTab;
	isVisible = true;

		// after opening the popup, we want to remove its entry from the
		// history, since it's not a real webpage.  doing this in a timeout
		// is kludgy, but the history doesn't seem to have been updated by
		// this point, so wait a second and then delete it.
	setTimeout(() => chrome.history.deleteUrl({ url }), 1000);

	return window;
}


async function show(
	activeTab,
	alignment)
{
	const targetWindow = await getWindow(activeTab);
	const bounds = calcBounds(
		targetWindow,
		{
			alignment,
			width: currentWidth,
			height: currentHeight,
		}
	);
	let window;

	try {
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
				await chrome.windows.update(windowID, { focused: true, left: bounds.left, top: bounds.top });
			}

				// we seem to have to pass width and height here, even if they
				// haven't changed, to keep the window from shifting size
			window = await chrome.windows.update(windowID, { focused: true, ...bounds });
		} else {
				// create a popup window with the tab that's hiding in another
				// window, instead of passing in a URL.  that will move the
				// existing tab into the new popup.
			window = await createPopup({ tabId: tabID, ...bounds });
		}
	} catch (e) {}

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
			await chrome.tabs.move(tabID, {
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

	if (hideBehavior == Tab
		|| (hideBehavior == Behind && (!targetTabOrWindow || targetTabOrWindow.id === tabID))) {
			// if we didn't get a target to hide behind, probably because
			// a devtools window got focused, then temporarily fall back to
			// hiding in a tab, so that the popup is no longer visible.  the
			// target may also be the popup itself, usually when a window from a
			// different profile is focused, which means we can't get the bounds
			// of that window, so we have to hide in a tab.
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
					width: currentWidth,
					height: currentHeight,
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

DEBUG && hideBehavior == Behind && (!Number.isInteger(options.left) || !Number.isInteger(options.top)) && console.error("==== bad popup options", options, targetWindow);

		try {
			const {state} = await chrome.windows.update(windowID, options);

			if (hideBehavior == Minimize && state !== "minimized") {
					// for some irritating reason, minimizing the popup after it
					// was blurred because another window was focused doesn't
					// work reliably.  and just trying it again immediately also
					// doesn't work.  waiting even 100ms wasn't reliable, so wait
					// a whole quarter second to minimize it again.  ffs
				setTimeout(() => chrome.windows.update(windowID, options), 250);
			}

				// get the target window's current state after updating the popup
			targetWindow = await getWindow(targetTabOrWindow);

			if (unfocus && !targetWindow.focused) {
					// we just unfocused the popup, but the targetWindow
					// didn't become focused, probably because we're on
					// macOS, so force it into focus
				await chrome.windows.update(targetWindow.id, { focused: true });
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
!windowID && console.error("----- blur called without a window ID");
	isVisible = false;

	try {
		await chrome.windows.update(windowID, { focused: false });
	} catch (e) {}

	popupEmitter.emit("blur", { windowID });
}


async function resize(
	width,
	height)
{
	if (height < 0) {
		return;
	}

	currentWidth = width;
	currentHeight = height;

	try {
		await chrome.windows.update(windowID, { width, height });
	} catch (e) {}
}


async function close()
{
		// look for any open popup tabs.  there should only ever be one, but
		// at least one time, two got opened, so get them all to be safe.
	const openTabs = await chrome.tabs.query({ url: `${PopupURL}*` });
	const originalWindowID = windowID;

		// set the IDs to 0 before calling remove(), so that if someone
		// calls isOpen() before the tab is fully closed, isOpen will
		// return false
	windowID = 0;
	tabID = 0;
	isVisible = false;
	await saveLastPopupIDs();

	try {
		await chrome.tabs.remove(openTabs.map(({id}) => id));
	} catch (e) {}

	if (originalWindowID) {
			// close() may be called even when there's no open popup, so only
			// dispatch the event if the window was actually open
		popupEmitter.emit("close", { windowID: originalWindowID });
	}
}


	// listen for calls to these functions from the popup.html page
receive({
	show,
	hide,
	blur,
	resize,
});


export default {
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

	async isOpen() {
		const [popupWindowTab] = await chrome.runtime.getContexts({ tabIds: [tabID] });

		return !!popupWindowTab;
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

	get tabID() {
		return tabID;
	},

	get isVisible() {
		return isVisible;
	},

	get activeTab() {
		return lastActiveTab;
	}
};
