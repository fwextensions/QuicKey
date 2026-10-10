import { debounce } from "@/background/debounce";
import recentTabs from "@/background/recent-tabs";
import trackers from "@/background/page-trackers";
import { MinTabDwellTime } from "@/background/constants";
import { isPopupWindow } from "@/background/popup-utils";

const tracker = trackers.background;

	// returns a debounced function that records a tab as the most recent one,
	// once the user has stayed on it for the dwell time.  it also records the
	// tab as the controller's activeTab.
export function createAddTab(
	state)
{
	return debounce(
			// make sure tabId is valid, as calling tabs.get() with undefined will
			// throw an exception that isn't caught by the .catch() below
		tabId => Number.isInteger(tabId) && chrome.tabs.get(tabId)
			.then(tab => {
					// update activeTab to be the one we're pushing onto recents, but
					// only if it's not the popup window.  though handleTabActivated()
					// checks popupWindow.id, that may be 0 right after it's been
					// created and triggers the tab activated event.
				if (!isPopupWindow(tab)) {
					state.activeTab = tab;

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
}
