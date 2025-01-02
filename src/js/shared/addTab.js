import { debounce } from "@/background/debounce";
import recentTabs from "@/background/recent-tabs";
import trackers from "@/background/page-trackers";
import { MinTabDwellTime } from "@/background/constants";
import { isPopupWindow } from "@/background/popup-utils";

const tracker = trackers.background;
let activeTab;

export const addTab = debounce(
		// make sure tabId is valid, as calling tabs.get() with undefined will
		// throw an exception that isn't caught by the .catch() below
	tabId => Number.isInteger(tabId) && chrome.tabs.get(tabId)
		.then(tab => {
				// update activeTab to be the one we're pushing onto recents, but
				// only if it's not the popup window.  though handleTabActivated()
				// checks popupWindow.id, that may be 0 right after it's been
				// created and triggers the tab activated event.
			if (!isPopupWindow(tab)) {
				activeTab = tab;

				return recentTabs.add(tab);
			}
		})
		.catch(error => {
				// ignore the "No tab with id:" errors, which will happen
				// closing a window with multiple tabs.  since addTab()
				// is debounced and will fire after the window is closed,
				// the tab no longer exists at that point.
			if (error?.message?.indexOf("No tab") !== 0) {
				tracker.exception(error);
				console.error(`ERROR: tabId: ${tabId}.`, error);
			}
		}),
	MinTabDwellTime
);

	// make activeTab settable directly from the outside, without having to
	// export a function
Object.defineProperty(module.exports, "activeTab", {
	get: () => activeTab,
	set: tab => (activeTab = tab),
	enumerable: true,
	configurable: true
});
