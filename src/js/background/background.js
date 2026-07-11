	// this triggers warnings about having to add a listener for error on the
	// initial evaluation of the worker script, but it still seems to work
import "@/lib/error-handler";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";
import recentTabs from "@/background/recent-tabs";
import storage from "@/background/quickey-storage";
import trackers from "@/background/page-trackers";
import { debounce } from "@/background/debounce";
import * as k from "@/background/constants";
import { isPopupWindow } from "@/background/popup-utils";
import initEventController from "@/shared/eventController";
import state from "@/shared/state";

if (globalThis.DEBUG) {
	globalThis.printTabs = recentTabs.print;
}

	// if the popup is opened and closed within this time, switch to the
	// previous tab
const MaxPopupLifetime = 450;
const RestartDelay = 60 * 1000;
const TabActivatedOnStartupDelay = 750;
const tracker = trackers.background;


const ports = {};
//let startingUp = false;
let installedPromise = new Promise(resolve => {
	chrome.runtime.onInstalled.addListener(details => resolve(details));
});
let lastUsedVersion;


	// this returns a function for sending messages *from* the popup, which we
	// don't need
initEventController({
	sendPopupMessage(
		message,
		payload = {})
	{
		try {
			// default to sending the message to the menu if it's open
			(ports.menu || ports.popup).postMessage({ message, ...payload });

chrome.runtime.lastError && console.log("==== sendPopupMessage after postMessage", chrome.runtime.lastError);

			return chrome.runtime.lastError;
		} catch (error) {
console.error("==== sendPopupMessage", error.message);
			return error;
		}
	},
	ports
});


// TODO: this event doesn't seem to get triggered, or isn't getting cached in the sw.js
chrome.runtime.onStartup.addListener(() => {
	const onActivated = debounce(() => {
		chrome.tabs.onActivated.removeListener(onActivated);

DEBUG && console.log("==== last onActivated", state.startingUp);

			// we only need to call updateAll() if Chrome is still starting up,
			// since startingUp will be set to false when the popup opens,
			// which will also update all the tabs
		if (state.startingUp) {
				// the stored recent tab data will be out of date, since the tabs
				// will get new IDs when the app reloads each one
			return recentTabs.updateAll()
				.then(() => {
DEBUG && console.log("===== updateAll done");

					state.startingUp = false;
				});
		}
	}, TabActivatedOnStartupDelay);

DEBUG && console.log("== onStartup");

globalThis.START = Date.now();

	state.startingUp = true;
	chrome.tabs.onActivated.addListener(onActivated);
});


// TODO: handle enabling and disabling the keyboard shortcuts
function enableCommands()
{
		// just in case the listener hasn't already been removed, call this
		// so we don't add two listeners
//	disableCommands();
//	chrome.commands.onCommand.addListener(onCommandListener);
}


function disableCommands()
{
//	chrome.commands.onCommand.removeListener(onCommandListener);
}


chrome.runtime.onConnect.addListener(port => {
	if (port.name !== "popup" && port.name !== "menu") {
		return;
	}
//console.log("---- background: onConnect", port?.name);

	const connectTime = Date.now();
	let closedByEsc = false;

DEBUG && console.log("== onConnect", port.name, state.startingUp);

		// in newer versions of Chrome, reopened tabs don't trigger an
		// onActivated event, so the handler set in onStartup won't fire
		// until the first tab is manually activated.  set startingUp to
		// false here in case the user opens the menu before that happens.
	state.startingUp = false;
	ports[port.name] = port;

	if (port.name == "menu") {
		disableCommands();
	}

// TODO: this only needs to be done for the menu case
	port.onMessage.addListener(message => {
//console.log("---- background: onMessage", port.name, message);
		closedByEsc = (message == "closedByEsc");
	});

	port.onDisconnect.addListener(port => {
		ports[port.name] = null;
		state.activeTab = null;
//console.log("---- background: onDisconnect", port.name);

		if (port.name == "popup") {
// TODO: remove popupWindow.isOpen?
//			if (popupWindow.isOpen) {
				popupWindow.close();
//			}
		} else {
			enableCommands();
		}

		if (!closedByEsc && Date.now() - connectTime < MaxPopupLifetime) {
				// this was a double-press of alt-Q, so toggle the tabs
			toggleRecentTabs();
		} else {
				// send a background "pageview", since the popup is now closed,
				// so that GA will track the time the popup was open
			tracker.pageview();
		}
	});
});


chrome.runtime.onMessage.addListener(({message, ...payload}) => {
	if (message === "reopenPopup") {
		(async () => {
			const currentActiveTab = state.activeTab;

				// instead of closing the popup and then calling
				// openPopupWindow() to reopen it, we just call create(),
				// which always closes the window first, and pass the current
				// activeTab, since the query in openPopupWindow() seems to
				// not find a last focused window, so we end up with an
				// undefined activeTab
			await popupWindow.create(currentActiveTab, payload.focusSearch);

				// restore activeTab, which gets cleared when the port from
				// the popup is closed
			state.activeTab = currentActiveTab;
		})();
	}
});


chrome.runtime.onUpdateAvailable.addListener(details => {
	function restartExtension()
	{
		if (!ports.menu && !popupWindow.isVisible) {
DEBUG && console.log("=== reloading");
			chrome.runtime.reload();
		} else {
			setTimeout(restartExtension, RestartDelay);
		}
	}

	try {
		tracker.event("extension", "update-available", details?.version);
	} catch (e) {
DEBUG && console.log(e);
	}

	restartExtension();
});


enableCommands();

chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] })
	.then((initialViews) => {
			// check that the popup window is open, and not just the Options tab
		if (initialViews.some(isPopupWindow)) {
			const popupPort = chrome.runtime.connect({ name: "popup" });

				// generate a connect event with this new port.  if there's no popup
				// window for it connect to, it'll immediately close.
			chrome.runtime.onConnect.dispatch(popupPort);
		}
	});

storage.set(data => {
		// save the lastUsedVersion in a global before we return the current
		// version below, so the onInstalled promise handler knows whether
		// to open the options page.  of course, to do that, we need to make
		// sure that promise is handled as part of the chain started from
		// getting the lastUsedVersion.  otherwise, the onInstalled promise
		// below would always think it was being updated.
	({lastUsedVersion} = data);

		// set which icon to show in the toolbar based on the color scheme that
		// we saw the last time we were run.  if it's changed since then, we'll
		// need to wait for the popup or menu to open to update the icon, but
		// most of the time the last seen scheme is a reasonable default.
	toolbarIcon.setColorScheme(data.colorScheme);

	return {
		lastUsedVersion: k.Version,
	};
})
	.then(() => {
		tracker.pageview();
		tracker.timing("loading", "background-loaded", performance.now());

			// now that everything is set up, fire all the cached events
		globalThis.dispatchCachedEvents();
DEBUG && console.log("%c%s", "background: darkgreen; color: white;", "====== startup done ======", performance.now());
	})
		// pause the chain to wait for the installed promise to resolve,
		// which it will never do if the event doesn't fire.  if it does,
		// it should do so before we get here, but we use a promise just
		// in case it doesn't for some reason.
	.then(() => installedPromise)
	.then(({reason, previousVersion}) => {
		tracker.event("extension", reason, previousVersion);

		if (reason === "update" && lastUsedVersion.startsWith("1.8")) {
				// open the options page with an update message about the new
				// popup window options
			chrome.tabs.create({
				url: chrome.runtime.getURL("options.html#/popup?welcome-v2")
			});
			tracker.event("extension", "open-options");
		}
	})
	.catch(error => tracker.exception(error));
