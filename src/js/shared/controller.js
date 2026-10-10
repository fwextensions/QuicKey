import { createAddTab } from "@/shared/addTab";
import createTabEventHandlers from "@/shared/tabEventHandlers";
import createCommandHandlers from "@/shared/commandHandlers";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";
import settings from "@/background/settings";
import * as k from "@/background/constants";

	// the settings the controller mirrors, so it doesn't have to read storage
	// on every command
const ControllerSettingKeys = [
	k.ShowTabCount.Key,
	k.HidePopupBehavior.Key,
	k.CurrentWindowLimitRecents.Key,
	k.NavigateRecentsWithPopup.Key,
];


	// the controller handles the browser's tab events and the keyboard
	// commands.  the worker and the hidden popup page each create one, but
	// only the context holding the control lock runs it; the other's
	// listeners stay attached but do nothing.  if the worker dies, the popup
	// inherits the lock and its controller takes over.
	//
	// popupLink is how the controller reaches the popup or toolbar menu:
	//   isPopupConnected() - whether the popup window's page is open
	//   isMenuConnected() - whether the toolbar menu is open
	//   notify(name, payload) - call a method on the menu, if it's open, or
	//     else the popup.  returns a promise for whether it was delivered.
export function createController({
	popupLink })
{
	const state = {
			// set while Chrome is restoring a session, so its tab churn isn't
			// recorded as the user's activity
		startingUp: false,
			// the tab that was active when the popup was opened
		activeTab: null,
		navigatingRecents: false,
		navigateRecentsWithPopup: false,
		currentWindowLimitRecents: false,
	};
	const addTab = createAddTab(state);
	const internals = { state, addTab, popupLink };
	const tabEvents = createTabEventHandlers(internals);
	const commands = createCommandHandlers(internals);


	function applySetting(
		key,
		value)
	{
		if (key == k.ShowTabCount.Key) {
			toolbarIcon.showTabCount(value);
		} else if (key == k.HidePopupBehavior.Key) {
			popupWindow.hideBehavior = value;
		} else if (key == k.CurrentWindowLimitRecents.Key) {
			state.currentWindowLimitRecents = value;
		} else if (key == k.NavigateRecentsWithPopup.Key) {
			state.navigateRecentsWithPopup = value;
		}
	}


		// the methods the popup and options pages call on whichever context
		// holds control.  each takes a single payload object.
	const api = {
		getActiveTab: () => state.activeTab,

		executeAddTab: () => {
// TODO: this seems to not get called when quickly switching between tabs without waiting for the dwell time to expire and then hitting alt-Q.  the wrong tab is at the top of the list.
			addTab.flush();
		},

		stopNavigatingRecents: () => {
			state.navigatingRecents = false;
		},

		settingChanged: ({ key, value }) => applySetting(key, value),
	};


	return {
		state,
		api,
		addTab,
		toggleRecentTabs: commands.toggleRecentTabs,

			// add the chrome listeners.  they're gated on control, so this can
			// be called before this context holds it.
		listen()
		{
			tabEvents.listen();
			commands.listen();
		},

			// called once this context holds control
		start()
		{
			commands.start();

				// update this flag in case the popup gets hidden or closed while
				// the user is navigating recents by some mechanism other than
				// releasing the modifier to select the currently focused tab
			popupWindow.on(["hide", "close"], () => state.navigatingRecents = false);

			return settings.get()
				.then(settings => ControllerSettingKeys.forEach(
					key => applySetting(key, settings[key])));
		}
	};
}

