import { addTab } from "@/shared/addTab";
import state from "@/shared/state";
import { addListener, removeListener } from "@/shared/controlledEvent";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";
import recentTabs from "@/background/recent-tabs";
import settings from "@/background/settings";
import trackers from "@/background/page-trackers";
import { isPopupWindow } from "@/background/popup-utils";
import * as k from "@/background/constants";

const {
	OpenPopupCommand,
	PreviousTabCommand,
	NextTabCommand,
	ToggleTabsCommand,
	FocusPopupCommand
} = k.CommandIDs;

const tracker = trackers.background;
let lastTogglePromise = Promise.resolve();
let lastOpenPromise = Promise.resolve();
let currentWindowLimitRecents = false;
let ports = {};
let sendPopupMessage;

function handleCommand(
	command)
{
console.log("===== handleCommand from control", globalThis.location.pathname, command);
	switch (command) {
		case OpenPopupCommand:
		case FocusPopupCommand:
				// call openPopupWindow() in a finally() method so that the promise
				// chain won't stop if there's an uncaught exception at some point.
				// we need to wait for the previous call to openPopupWindow() to
				// settle before calling it again in case the user is spamming
				// alt-Q.  without waiting, the second key press would find the
				// first one hadn't finished opening yet and tell the partially
				// loaded popup to close and open a new one.  rinse and repeat.
			lastOpenPromise = lastOpenPromise
				.finally(() => openPopupWindow(command === FocusPopupCommand));
			break;

		case PreviousTabCommand:
		case NextTabCommand:
			lastTogglePromise = lastTogglePromise
				.finally(() => navigateRecents(
					command === PreviousTabCommand ? -1 : 1,
					currentWindowLimitRecents
				));
			break;

		case ToggleTabsCommand:
			toggleRecentTabs(true);
			break;
	}
}

async function openPopupWindow(
	focusSearch = false)
{
		// we used to set activeTab directly here, and then change it back to the
		// previous value in the last branch below.  that caused issues when we
		// were also awaiting popupWindow.isOpen().  if the user pressed alt-Q
		// quickly, a second command event could get handled while we were
		// awaiting isOpen().  the second invocation would then cache the previous
		// tab as the popup as well, causing it to send showWindow, which would
		// then reset the selection, making it impossible to move down quickly.
	const [currentActiveTab] = await chrome.tabs.query({
		active: true,
		lastFocusedWindow: true
	});

	if (!(await popupWindow.isOpen())) {
		state.activeTab = currentActiveTab;

			// the popup window isn't open, so create a new one.  tell it whether
			// to focus the search box or navigate recents.
		return popupWindow.create(
			state.activeTab,
			{ focusSearch, navigatingRecents: state.navigatingRecents },
			state.navigatingRecents ? "right-center" : "center-center"
		);
	}

	if (!isPopupWindow(currentActiveTab)) {
		state.activeTab = currentActiveTab;

			// the popup window is open but not focused, so tell it to show
			// itself centered on the current browser window, and whether to
			// select the first item.  if there's no activeTab (such as when
			// the shortcut is pressed and a devtools window is in the
			// foreground), the popup will appear aligned to the screen.
		return sendPopupMessage("showWindow", { focusSearch, activeTab: state.activeTab });
	}

		// the popup is open and focused, so use the shortcut to move the
		// selection DOWN
	if (sendPopupMessage("modifySelected", { direction: 1 })) {
console.error("===== openPopupWindow modifySelected", globalThis.location.pathname);
			// an error was returned from sending the message, so close
			// the popup
		return popupWindow.close();
	}
}

async function navigateRecents(
	direction,
	limitToCurrentWindow)
{
		// track whether the user is navigating farther back in the stack
	const label = toolbarIcon.isNormal ? "single" : "repeated";
	const action = direction == -1 ? "previous" : "next";

	if ((ports.popup && popupWindow.isVisible && !state.navigatingRecents) || ports.menu) {
			// for recentTabs.navigate(), -1 is further back in the stack,
			// but for the menu, 1 is moving the selection down, which is
			// equivalent to going further back in the stack, so negate
			// the value
		sendPopupMessage("modifySelected", {
			direction: -direction
		});
	} else {
		if (state.navigateRecentsWithPopup) {
				// when navigating with recents, we want to ignore the "next"
				// direction if the window isn't currently visible, since that
				// would just mean navigating to the currently active tab
			if (direction == -1 || popupWindow.isVisible) {
				state.navigatingRecents = true;

					// execute any pending tab activation event so the recents
					// list is up-to-date before we start navigating.  we have to
					// do this regardless of whether the popup is open or not.
				await addTab.execute();

				if (!ports.popup) {
						// since the popup isn't currently open, we rely on it
						// to detect that it's being opened to navigate recents
						// and then change the selection instead of sending it
						// the modifySelected message below
					await openPopupWindow();
				} else {
					sendPopupMessage("modifySelected", {
						direction: -direction,
						navigatingRecents: true
					});
				}
			}
		} else if (direction == -1 || !toolbarIcon.isNormal) {
				// we only want to invert the icon and start navigating if
				// the user is going backwards or is going forwards before
				// the cooldown ends
			await toolbarIcon.invertFor(k.MinTabDwellTime);
			await recentTabs.navigate(direction, limitToCurrentWindow);
		}

			// this will record an event if the user hits alt-S when they're
			// not currently navigating, but probably not worth worrying about
		tracker.event("recents", action, label);
	}
}

function toggleRecentTabs(
	fromShortcut)
{
		// we have to wait for the last toggle promise chain to resolve before
		// starting the next one.  otherwise, if the toggle key is held down,
		// the events fire faster than recentTabs.toggle() can keep up, so
		// the tabIDs array isn't updated before the next navigation happens,
		// and the wrong tab is navigated to.  even if we made this an async
		// function, we'd still have to store the promise it returns somewhere
		// and await that before calling this function again; otherwise, the
		// event handler would keep starting new chains.  seems cleanest to
		// keep the promise chain handling just within this function.
	lastTogglePromise = lastTogglePromise
			// if the user navigated to a tab but hasn't waited for the min
			// dwell time before toggling back, add the current tab before
			// toggling so it becomes the most recent
		.then(() => addTab.execute())
		.then(() => {
			if (state.navigatingRecents) {
					// tell the popup that the user's no longer navigating
					// recents, so that when it gets blurred after we toggle
					// to the previous tab, it'll close itself
				sendPopupMessage("stopNavigatingRecents");
			}

			state.navigatingRecents = false;

				// in case the user was navigating recents during a cooldown and
				// then hit the toggle command, reset the icon back to normal
			return toolbarIcon.setNormalIcon();
		})
		.then(() => recentTabs.toggle(currentWindowLimitRecents))
			// fire the debounced addTab() so the tab we just toggled to will
			// be the most recent, in case the user quickly toggles again.
			// otherwise, the debounced add would fire after we navigate,
			// putting that tab on the top of the stack, even though a
			// different tab was now active.  pass true to tell execute() we want
			// to wait for the next addTab event if there isn't one pending.
			// that will also cause the next addTab to be executed immediately.
		.then(() => addTab.execute(true))
		.then(() => tracker.event("recents",
			fromShortcut ? "toggle-shortcut" : "toggle"));
}

function handlePopupMessage(
	{ message, ...payload },
	sender,
	sendResponse)
{
	if (message === "executeAddTab") {
// TODO: this seems to not get called when quickly switching between tabs without waiting for the dwell time to expire and then hitting alt-Q.  the wrong tab is at the top of the list.
		addTab.execute();
	} else if (message === "stopNavigatingRecents") {
		state.navigatingRecents = false;
	} else if (message === "getActiveTab") {
		sendResponse(state.activeTab);
	} else if (message === "settingChanged") {
		const { key, value } = payload;

		if (key == k.ShowTabCount.Key) {
			toolbarIcon.showTabCount(value);
		} else if (key == k.HidePopupBehavior.Key) {
			popupWindow.hideBehavior = value;
		} else if (key == k.CurrentWindowLimitRecents.Key) {
			currentWindowLimitRecents = value;
		} else if (key == k.NavigateRecentsWithPopup.Key) {
			state.navigateRecentsWithPopup = value;
		}
	}
}

export default function init(
	context)
{
	({ sendPopupMessage, ports } = context);

	addListener("commands.onCommand", handleCommand);

	return (context) => {
		context.runtimeMessage.addListener(handlePopupMessage);

			// update this flag in case the popup gets hidden or closed while the user
			// is navigating recents by some mechanism other than releasing the modifier
			// to select the currently focused tab
		popupWindow.on(["hide", "close"], () => state.navigatingRecents = false);

		settings.get()
			.then(settings => {
				toolbarIcon.showTabCount(settings[k.ShowTabCount.Key]);
				popupWindow.hideBehavior = settings[k.HidePopupBehavior.Key];
				currentWindowLimitRecents = settings[k.CurrentWindowLimitRecents.Key];
				state.navigateRecentsWithPopup = settings[k.NavigateRecentsWithPopup.Key];
			});
	};

// TODO: get this to work so the startup case is handled
//	function onCommandListener(
//		command)
//	{
//		if (!startingUp) {
//			handleCommand(command);
//		} else {
//				// as below in the onConnect handler, the user is interacting
//				// with the extension before the last onActivated event happened,
//				// so we're clearly not starting up anymore.  since the onActivated
//				// handler didn't call updateAll(), we need to do that before
//				// handling the command.  otherwise, the stored tab IDs are likely
//				// to be out of sync with the reopened tabs and navigation will fail.
//			startingUp = false;
//			recentTabs.updateAll()
//				.then(() => handleCommand(command));
//		}
//	}
}
