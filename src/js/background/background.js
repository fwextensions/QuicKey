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
	// how long to keep retrying the match between the stored recents and the
	// restored tabs after Chrome starts, and the minimum interval between
	// attempts.  it's a time budget rather than a pass count because each pass
	// costs a chrome.tabs.query(), which can take seconds on a slow machine
	// with a lot of tabs -- a fixed count could tie up the storage lock for a
	// long time.  the pass that hits the deadline is the one that drops the
	// recents that still haven't matched.
const StartupUpdateTimeout = 10 * 1000;
const StartupUpdateRetryDelay = 1000;
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


	// Chrome used to fire tabs.onActivated for every tab it restored on
	// startup, so the only way to know the restore had finished was to wait
	// for those events to stop arriving.  it no longer does that for tabs
	// restored as already-active, so waiting for an activation that never
	// came meant updateAll() often never ran at all, leaving the stored
	// recents pointing at the pre-restart tab IDs (every lookup missing, so
	// the recency order collapsed) and lastStartupTime never updated.
	//
	// so remap immediately instead.  the reason for waiting in the first
	// place is still real, though: a restored tab that Chrome hasn't loaded
	// yet may not have its URL populated, and updateFromFreshTabs() matches
	// recents to tabs by URL.  matching too early would drop those recents
	// for good.  so the early passes retain whatever didn't match and we
	// retry while anything is still outstanding, letting only the final pass
	// drop the recents whose tabs really are gone.
chrome.runtime.onStartup.addListener(() => {
	log("onStartup fired");

	state.startingUp = true;

	(async () => {
		const deadline = Date.now() + StartupUpdateTimeout;
		let attempt = 0;

		try {
				// record that a restart happened *before* attempting any match,
				// so the fact of the restart survives the passes below failing.
				// updateFromFreshTabs() only writes lastUpdateTime when it had a
				// real tab list to work from, so if every pass runs against an
				// empty query -- the worker waking before Chrome restores the
				// session -- lastStartupTime stays ahead of lastUpdateTime and
				// getAll() picks up the rebuild on the next popup open.
			await storage.set(() => ({ lastStartupTime: Date.now() }));

			while (true) {
				const passTime = Date.now();
					// only retain unmatched recents if we'll get another look at
					// them; the pass that ends the loop has to be the one that
					// drops the recents whose tabs are really gone
				const isLastPass = passTime >= deadline;
				const {missingCount, pendingCount} =
					await recentTabs.updateAll(!isLastPass);

				attempt++;
				log("onStartup: updateAll pass", attempt,
					"took", Date.now() - passTime, "ms",
					"missing:", missingCount, "pending:", pendingCount);

					// retry only while tabs are still loading, since that's the
					// only reason another pass could match anything new.  a
					// recent that's missing because its tab was closed before
					// the restart stays missing no matter how long we wait, so
					// retrying on missingCount alone would burn every pass on
					// every startup -- expensive when tabs.query() is slow, and
					// it holds the storage lock the popup needs.
				if (isLastPass || !pendingCount) {
					if (pendingCount) {
						log("onStartup: gave up with", pendingCount,
							"tabs still loading");
					}

					break;
				}

					// the pass itself gave the pending tabs time to load, so
					// only top it up to the retry interval
				await delay(Math.max(StartupUpdateRetryDelay -
					(Date.now() - passTime), 0));
			}
		} catch (error) {
			log("onStartup: updateAll failed:", error.message);
			tracker.exception(error);
		}

			// resume recording tab events, which the handlers skip while
			// startingUp is true
		state.startingUp = false;

		log("onStartup: startup complete");
	})();
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
			// the popup opened before the post-startup updateAll() ran, so
			// the update is being skipped in favor of the getAll() path.
			// log it in case that path is what loses the history.
		log("onConnect:", port.name, "opened while startingUp, skipping updateAll");
	}

		// in newer versions of Chrome, reopened tabs don't trigger an
		// onActivated event, so the handler set in onStartup won't fire
		// until the first tab is manually activated.  set startingUp to
		// false here in case the user opens the menu before that happens.
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
