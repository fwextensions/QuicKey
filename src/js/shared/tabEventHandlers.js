import { addTab } from "@/shared/addTab";
import { startingUp, navigatingRecents } from "@/shared/state";
import { addListeners, removeListeners } from "@/shared/controlledEvent";
import toolbarIcon from "@/background/toolbar-icon";
import recentTabs from "@/background/recent-tabs";
import { debounce } from "@/background/debounce";
import popupWindow from "@/background/popup-window";
import { isPopupWindow } from "@/background/popup-utils";
import storage from "@/background/quickey-storage";

const TabRemovedDelay = 1000;

// TODO: handle the startup event so this is set correctly, add to state.js
//let startingUp = false;
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
				if (tabId !== tabIDs.at(-1)) {
//console.log("--- sending tabActivated", tabId, "old", tabIDs.slice(-1)[0]);
					sendPopupMessage("tabActivated");
				} else {
//console.log("--- NOT sending tabActivated");
				}
			});
		}
	}
}

const EventHandlers = {
	"tabs.onActivated": (event) =>
	{
			// if this isn't the startup event, handle the tab activation
		if (!startingUp) {
			handleTabActivated(event);
		}
	},
	"tabs.onCreated": (tab) =>
	{
		toolbarIcon.updateTabCount(1);

			// if this isn't the startup event and the tab isn't active and isn't a popup window,
			// add it to the recent tabs list
		if (!startingUp && !tab.active && !isPopupWindow(tab)) {
			recentTabs.add(tab, true);
		}
	},
	"tabs.onRemoved": (tabId, removeInfo) =>
	{
		toolbarIcon.updateTabCount(-1);

			// debounce the handling of a removed tab since Chrome seems to
			// trigger the event when shutting down, and we want to ignore
			// those.  hopefully, Chrome will finish quitting before this
			// handler fires.  we don't debounce the listener because we want
			// to update the tab count immediately above.
		handleTabRemoved(tabId, removeInfo);
	},
	"tabs.onReplaced": (newID, oldID) =>
	{
			// if this isn't the startup event, replace the old tab ID with the new one in the recent tabs list
		if (!startingUp) {
			recentTabs.replace(oldID, newID);
		}
	},
	"windows.onFocusChanged": (windowID) =>
	{
			// check this event's windowID against the last one we saw and
			// ignore the event if it's the same.  that happens when the popup
			// opens and no tab is selected or the user's double-pressing.
		if (
			!startingUp
			&& windowID !== chrome.windows.WINDOW_ID_NONE
			&& windowID != lastWindowID
		) {
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
	}
};

export default function init(
	context)
{
	({ sendPopupMessage, ports } = context);

	addListeners(EventHandlers);
}
