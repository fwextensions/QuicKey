import toolbarIcon from "@/background/toolbar-icon";
import recentTabs from "@/background/recent-tabs";
import { debounce } from "@/background/debounce";
import popupWindow from "@/background/popup-window";
import { isPopupWindow } from "@/background/popup-utils";
import storage from "@/background/quickey-storage";
import { addTab } from "@/shared/addTab";

const TabRemovedDelay = 1000;

// TODO: handle the startup event so this is set correctly
let startingUp = false;
let navigatingRecents = false;
let ports = {};
let lastWindowID;
let sendPopupMessage;

const handleTabRemoved = debounce(
	(tabId, removeInfo) => !startingUp && recentTabs.remove(tabId, removeInfo),
	TabRemovedDelay
);

function handleTabActivated({
	tabId})
{
		// don't add the popup window to the recent tabs.  even though
		// recentTabs.add() will ignore the popup window, we don't want to
		// notify the popup about its own activation, which would happen
		// because the last tab in tabIDs wouldn't match the event.  if the
		// user is navigating through tabs and activating each one as it's
		// selected, we don't want to update the recents list until they
		// finish and the window closes.  we also need to make sure tabId is
		// valid, since we may be getting called from an event that was triggered
		// by a window in another profile, in which case we can't access any
		// info about the tabs there.
	if (Number.isInteger(tabId) && tabId !== popupWindow.tabID && !navigatingRecents) {
		addTab(tabId);

		if (ports.popup) {
			storage.get(({tabIDs}) => {
					// if the newly activated tab is the same as the most
					// recent one in tabIDs, that means it was just
					// reactivated after the popup was hidden, so we don't
					// need to tell the popup to re-render in that case
				if (tabId !== tabIDs.slice(-1)[0]) {
//console.log("--- sending tabActivated", tabId, "old", tabIDs.slice(-1)[0]);
					sendPopupMessage("tabActivated");
				} else {
//console.log("--- NOT sending tabActivated");
				}
			});
		}
	}
}

export default function init(
	context)
{
	({ sendPopupMessage, ports } = context);


	chrome.tabs.onActivated.addListener(event => {
		if (!startingUp) {
			handleTabActivated(event);
		}
	});


	chrome.tabs.onCreated.addListener(tab => {
		toolbarIcon.updateTabCount(1);

		if (!startingUp && !tab.active && !isPopupWindow(tab)) {
				// this tab was opened by ctrl-clicking a link or by opening
				// all the tabs in a bookmark folder, so pass true to insert
				// this tab in the penultimate position, which makes it the
				// "most recent" tab
			recentTabs.add(tab, true);
		}
	});


	chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
		toolbarIcon.updateTabCount(-1);

			// debounce the handling of a removed tab since Chrome seems to
			// trigger the event when shutting down, and we want to ignore
			// those.  hopefully, Chrome will finish quitting before this
			// handler fires.  we don't debounce the listener because we want
			// to update the tab count immediately above.
		handleTabRemoved(tabId, removeInfo);
	});


		// tabs seem to get replaced with new IDs when they're auto-discarded by
		// Chrome, so we want to update any recency data for them
	chrome.tabs.onReplaced.addListener((newID, oldID) => {
		if (!startingUp) {
			recentTabs.replace(oldID, newID);
		}
	});


		// the onActivated event isn't fired when the user switches between
		// windows, so get the active tab in this window and store it
	chrome.windows.onFocusChanged.addListener(windowID => {
			// check this event's windowID against the last one we saw and
			// ignore the event if it's the same.  that happens when the popup
			// opens and no tab is selected or the user's double-pressing.
		if (!startingUp && windowID !== chrome.windows.WINDOW_ID_NONE &&
				windowID != lastWindowID) {
			lastWindowID = windowID;

			chrome.tabs.query({ active: true, windowId: windowID })
					// if this window doesn't have an active tab, it's likely in a
					// different profile, so this instance of QuicKey can't access
					// any info about it.  we'll just pass undefined to addTab(),
					// which will ignore it.
				.then(([tab = {}]) => handleTabActivated({
					tabId: tab.id,
					windowId: windowID
				}));
		}
	});
}
