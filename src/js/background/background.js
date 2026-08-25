	// this triggers warnings about having to add a listener for error on the
	// initial evaluation of the worker script, but it still seems to work
import "@/lib/error-handler";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";
import recentTabs from "@/background/recent-tabs";
import storage from "@/background/quickey-storage";
import trackers from "@/background/page-trackers";
import { isPopupWindow } from "@/background/popup-utils";
import handleStartup from "@/background/startup";
import log from "@/background/persistent-log";
import initEventController from "@/shared/eventController";
import { toggleRecentTabs } from "@/shared/commandHandlers";
import state from "@/shared/state";

if (globalThis.DEBUG) {
	globalThis.printTabs = recentTabs.print;
}

	// log every service worker startup, so we can see whether a Chrome
	// relaunch woke the worker at all, and whether onStartup fired after it
log("service worker loaded");

	// if the popup is opened and closed within this time, switch to the
	// previous tab
const MaxPopupLifetime = 450;
const RestartDelay = 60 * 1000;
	// how long the tab handlers stay quiet after a restart if nothing else
	// clears the flag.  generous, since a big profile can take over a minute to
	// restore, and the cost of being wrong is only that some of Chrome's own
	// restore churn lands in the recents.
const StartupWindow = 90 * 1000;

const tracker = trackers.background;


function delay(
	ms)
{
	return new Promise(resolve => setTimeout(resolve, ms));
}


const ports = {};
//let startingUp = false;
let installedPromise = new Promise(resolve => {
	chrome.runtime.onInstalled.addListener(details => resolve(details));
});


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


	// Chrome fires this well before the session is restored.  Measured on a
	// profile with ~2200 tabs across ~108 windows: chrome.tabs.query() returned
	// 0 tabs in 0 windows at +1s, +5s, +15s, +30s and +60s after the event, and
	// tabs.onCreated never fired at all for the restored tabs.  So there's
	// nothing here to match the stored recents against, and nothing to wait on.
	// An earlier version retried on a 10s budget: every pass ran against an
	// empty browser, and the queries got slower as Chrome got busier (2ms ->
	// 3027ms) while holding the storage lock the popup needs.
	//
	// So don't try.  Record that a restart happened and let the rematch run on
	// demand -- getAll() rebuilds when lastStartupTime is ahead of
	// lastUpdateTime or the stored IDs are broadly stale, and navigate()
	// rematches in place once it walks into a run of dead IDs.  Both run when
	// the data is actually wanted, by which time the browser has restored.
chrome.runtime.onStartup.addListener(() => {
	log("onStartup fired");

		// the tab handlers skip recording while this is set, so Chrome's own
		// restore activity isn't logged as the user visiting 2000 tabs.  it's
		// cleared by the first sign of the user doing something (onConnect,
		// below) and by the timeout here, in case they browse without opening
		// QuicKey at all.  it's module state either way, so a worker restart
		// clears it too.
	state.startingUp = true;
	delay(StartupWindow).then(() => {
		if (state.startingUp) {
			log("onStartup: startup window elapsed");
			state.startingUp = false;
		}
	});

		// written before anything tries to match, so the fact of the restart
		// survives having nothing to match against.  updateFromFreshTabs() only
		// writes lastUpdateTime when it had a real tab list, so this stays ahead
		// of it until a rebuild actually happens.
	storage.set(() => ({ lastStartupTime: Date.now() }))
		.catch(error => {
			log("onStartup: recording the startup time failed:", error.message);
			tracker.exception(error);
		});
});


chrome.runtime.onConnect.addListener(port => {
	if (port.name !== "popup" && port.name !== "menu") {
		return;
	}
//console.log("---- background: onConnect", port?.name);

	const connectTime = Date.now();
	let closedByEsc = false;

DEBUG && console.log("== onConnect", port.name, state.startingUp);

	if (state.startingUp) {
			// the user opening the popup or menu is the clearest sign that
			// Chrome has finished restoring, whatever the tab list says
		log("onConnect:", port.name, "opened while startingUp");
	}

		// whether or not the restore has actually finished, the user is
		// interacting with us, so their tab activity is real and should be
		// recorded from here on
	state.startingUp = false;
	ports[port.name] = port;

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

handleStartup({ storage, toolbarIcon, tracker, installedPromise });
