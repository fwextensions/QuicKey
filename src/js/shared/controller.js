import control from "@/shared/control";
import { createAddTab } from "@/shared/addTab";
import createTabEventHandlers from "@/shared/tabEventHandlers";
import createCommandHandlers from "@/shared/commandHandlers";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";
import settings from "@/background/settings";
import trackers from "@/background/page-trackers";
import log from "@/background/persistent-log";
import * as k from "@/background/constants";

const tracker = trackers.background;
const isBackgroundContext = typeof document === "undefined";

	// the settings the controller mirrors, so it doesn't have to read storage
	// on every command.  it picks up changes to them from storage.onChanged.
const ControllerSettingKeys = [
	k.ShowTabCount.Key,
	k.HidePopupBehavior.Key,
	k.CurrentWindowLimitRecents.Key,
	k.NavigateRecentsWithPopup.Key,
];


	// the controller handles the browser's tab events and the keyboard
	// commands.  the worker and the hidden popup page each create one, but
	// only the context holding the control lock runs it; the other's
	// listeners stay attached but do nothing.  the worker takes control
	// first, and hands it to the popup page once that page is ready, since a
	// page that's already open and warm handles a shortcut noticeably faster
	// than a worker that may have to be started for it.  the worker queues
	// for the lock again right away, so it takes control back when the page
	// goes away, and inherits it the same way if the page dies without the
	// handoff ever happening.
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
		// resolves once the settings the commands depend on have been loaded
	let settingsLoaded = Promise.resolve();
	const internals = {
		state,
		addTab,
		popupLink,
		whenSettingsLoaded: () => settingsLoaded,
	};
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


	function applySettings(
		settings,
		previousSettings = {})
	{
		ControllerSettingKeys.forEach(key => {
			if (settings[key] !== previousSettings[key]) {
				applySetting(key, settings[key]);
			}
		});
	}


		// the recents commands wait on this, since on a cold start the command
		// that woke the worker is handled before a settings read could finish.
		// otherwise they'd see the defaults above, and the first alt-shift-A
		// would navigate without the popup.  catch errors so a failed load
		// doesn't break every command.
	function loadSettings()
	{
		settingsLoaded = settings.get()
			.then(settings => applySettings(settings))
			.catch(error => tracker.exception(error));

		return settingsLoaded;
	}


		// every storage write fires this in every context, but only the holder
		// listens, and only the settings it mirrors are applied, and only when
		// they've changed.  everything is stored under the top-level data key.
	function handleStorageChanged(
		{ data },
		areaName)
	{
		const settings = data?.newValue?.settings;

		if (areaName === "local" && settings) {
			applySettings(settings, data.oldValue?.settings);
		}
	}


		// the state the context taking over needs: the controller's own, minus
		// startingUp, which is the worker's to track, and the popup window's.
		// the settings are included so the page is right before its own load
		// of them finishes.
	function snapshot()
	{
		const { startingUp, ...rest } = state;

		return {
			state: rest,
			popupWindow: popupWindow.snapshot(),
		};
	}


	function adopt(
		snapshot)
	{
		Object.assign(state, snapshot.state);
		popupWindow.adopt(snapshot.popupWindow);
	}


		// resolves the claim task's promise, which releases the lock.  null
		// while this context doesn't hold control.
	let releaseControl = null;
	let started = false;


		// take control whenever the lock is free, and keep taking it back after
		// each yield, so a context that handed control to the popup page gets it
		// again when that page goes away.  the loop ends when the extension
		// context is invalidated, since claimWhenAvailable() won't take the lock
		// then.
	async function claim()
	{
		while (chrome.runtime?.id) {
			let held = false;

			try {
				await control.claimWhenAvailable(() => {
					held = true;
					start();

					return new Promise((resolve) => releaseControl = resolve);
				});
			} catch (error) {
				log("controller: claiming control failed:", error?.message);
				tracker.exception(error);

				return;
			}

			if (!held) {
				return;
			}
		}
	}


		// give up control, for the popup page to take.  returns whether this
		// context held it.
	function yieldControl(
		reason)
	{
		if (!releaseControl) {
			return false;
		}

		log("controller: yielding control:", reason);

		const release = releaseControl;

		releaseControl = null;
		release();

		return true;
	}


		// the methods the popup calls on whichever context holds control.  each
		// takes a single payload object.  add any new ones to ControllerApiNames
		// in controller-api.js.
	const api = {
		getActiveTab: () => state.activeTab,

		flushAddTab: () => {
// TODO: this seems to not get called when quickly switching between tabs without waiting for the dwell time to expire and then hitting alt-Q.  the wrong tab is at the top of the list.
			addTab.flush();
		},

		stopNavigatingRecents: () => {
			state.navigatingRecents = false;
		},

	};


		// add the chrome listeners.  they're gated on control, so this can be
		// called before this context holds it.
	function listen()
	{
		tabEvents.listen();
		commands.listen();

			// the worker handles commands from here on, so start loading the
			// settings now.  taking control waits for a lock, so on a cold
			// start that can come after the replayed command is handled.
		if (isBackgroundContext) {
			loadSettings();
		}
	}


		// called each time this context takes control
	function start()
	{
		commands.start();

		if (!started) {
			started = true;

				// update this flag in case the popup gets hidden or closed while
				// the user is navigating recents by some mechanism other than
				// releasing the modifier to select the currently focused tab
			popupWindow.on(["hide", "close"], () => state.navigatingRecents = false);

				// listen before reading the current settings, so a change made
				// in between isn't missed.  applying a setting twice is
				// harmless.  this stays attached after a yield, so the mirror is
				// current when control comes back.
			chrome.storage.onChanged.addListener(handleStorageChanged);
		}

			// a page context only starts handling commands now
		return isBackgroundContext ? settingsLoaded : loadSettings();
	}


	return {
		state,
		api,
		addTab,
		toggleRecentTabs: commands.toggleRecentTabs,
		snapshot,
		adopt,
		listen,
		start,
		claim,
		yieldControl,
	};
}


	// create a controller, add its listeners, and start it whenever this
	// context gets control
export function startController(
	options)
{
	const controller = createController(options);

	controller.listen();
	controller.claim();

	return controller;
}
