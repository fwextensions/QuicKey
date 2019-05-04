	// if the popup is opened and closed within this time, switch to the
	// previous tab
const MaxPopupLifetime = 450,
	TabActivatedOnStartupDelay = 750,
	TabRemovedDelay = 1000,
	MinTabDwellTime = 750,
	RestartDelay = 10 * 1000,
	IconPaths = {
		path: {
			"19": "img/icon-19.png",
			"38": "img/icon-38.png"
		}
	},
	InvertedIconPaths = {
		path: {
			"19": "img/icon-19-inverted.png",
			"38": "img/icon-38-inverted.png"
		}
	};


var gStartingUp = false,
	gResolveInstalledPromise,
	gInstalledPromise = new Promise(function(resolve) {
		gResolveInstalledPromise = resolve;
	});


function debounce(
	func,
	wait)
{
	var timeout;

	return function() {
		var context = this,
			args = arguments;

		clearTimeout(timeout);
		timeout = setTimeout(function() {
			timeout = null;
			func.apply(context, args);
		}, wait);
	};
}


chrome.runtime.onStartup.addListener(function() {
	const onActivated = debounce(function()
	{
		chrome.tabs.onActivated.removeListener(onActivated);

DEBUG && console.log("==== last onActivated");

			// we only need to call updateAll() if Chrome is still starting up,
			// since gStartingUp will be set to false when the popup opens,
			// which will also update all the tabs
		if (gStartingUp) {
			require([
				"background/recent-tabs"
			], function(
				recentTabs
			) {
					// the stored recent tab data will be out of date, since the tabs
					// will get new IDs when the app reloads each one
				return recentTabs.updateAll()
					.then(function() {
DEBUG && console.log("===== updateAll done");

						gStartingUp = false;
					});
			});
		}
	}, TabActivatedOnStartupDelay);

DEBUG && console.log("== onStartup");

	gStartingUp = true;
	chrome.tabs.onActivated.addListener(onActivated);
});


chrome.runtime.onInstalled.addListener(function(event) {
	gResolveInstalledPromise(event && event.reason);
});


require([
	"cp",
	"background/recent-tabs",
	"background/page-trackers",
	"background/quickey-storage"
], function(
	cp,
	recentTabs,
	trackers,
	storage
) {
	const backgroundTracker = trackers.background;
	var popupIsOpen = false;
	var addFromToggle = false;
	var shortcutTimer;
	var lastWindowID;


		// save the current time so recentTabs.getAll() knows whether it needs
		// to update the stored data
	storage.set(function(data) {
		return {
			lastStartupTime: Date.now(),
			lastUsedVersion: chrome.runtime.getManifest().version
		};
	});


	function addTab(
		data)
	{
		if (data.tabId) {
			return cp.tabs.get(data.tabId)
				.then(recentTabs.add)
				.catch(function(error) {
						// ignore the "No tab with id:" errors, which will happen
						// closing a window with multiple tabs.  since addTab()
						// is debounced and will fire after the window is closed,
						// the tab no longer exists at that point.
					if (error && error.message && error.message.indexOf("No tab") != 0) {
						backgroundTracker.exception(error);
					}
				});
		} else {
				// the event parameter is just the tab itself, so add it directly
			return recentTabs.add(data);
		}
	}

	const debouncedAddTab = debounce(addTab, MinTabDwellTime);


	function onTabChanged(
		event)
	{
		if (addFromToggle) {
				// when we're toggling between tabs, we want to add the tab
				// immediately because the user chose it, as opposed to
				// ctrl-tabbing past it
			addFromToggle = false;
			addTab(event);
		} else {
			startInversionTimer();
			debouncedAddTab(event);
		}
	}


	function handleCommand(
		command)
	{
		if (command == "1-previous-tab") {
			recentTabs.navigate(-1);
			backgroundTracker.event("recents", "previous");
		} else if (command == "2-next-tab") {
			recentTabs.navigate(1);
			backgroundTracker.event("recents", "next");
		}
	}


	function startInversionTimer()
	{
		chrome.browserAction.setIcon(InvertedIconPaths);
		clearTimeout(shortcutTimer);
		shortcutTimer = setTimeout(onInversionTimerDone, MinTabDwellTime);
	}


	function onInversionTimerDone()
	{
		chrome.browserAction.setIcon(IconPaths);
	}


	chrome.tabs.onActivated.addListener(function(event) {
		if (!gStartingUp) {
			onTabChanged(event);
		}
	});


		// debounce the handling of a removed tab since Chrome seems to trigger
		// the event when shutting down, and we want to ignore those.  hopefully,
		// Chrome will finish quitting before this handler fires.
	chrome.tabs.onRemoved.addListener(debounce(function(tabId, removeInfo) {
		if (!gStartingUp) {
			recentTabs.remove(tabId, removeInfo);
		}
	}, TabRemovedDelay));


		// tabs seem to get replaced with new IDs when they're auto-discarded by
		// Chrome, so we want to update any recency data for them
	chrome.tabs.onReplaced.addListener(function(newID, oldID) {
		if (!gStartingUp) {
			recentTabs.replace(oldID, newID);
		}
	});


		// the onActivated event isn't fired when the user switches between
		// windows, so get the active tab in this window and store it
	chrome.windows.onFocusChanged.addListener(function(windowID) {
			// check this event's windowID against the last one we saw and
			// ignore the event if it's the same.  that happens when the popup
			// opens and no tab is selected or the user's double-pressing.
		if (!gStartingUp && windowID != chrome.windows.WINDOW_ID_NONE &&
				windowID != lastWindowID) {
			lastWindowID = windowID;
			cp.tabs.query({ active: true, windowId: windowID })
				.then(function(tabs) {
					if (tabs.length) {
						onTabChanged(tabs[0]);
					}
				});
		}
	});


	chrome.commands.onCommand.addListener(function(command) {
		if (!gStartingUp) {
			handleCommand(command);
		} else {
				// as below in the onConnect handler, the user is interacting
				// with the extension before the last onActivated event happened,
				// so we're clearly not starting up anymore.  since the onActivated
				// handler didn't call updateAll(), we need to do that before
				// handling the command.  otherwise, the stored tab IDs are likely
				// to be out of sync with the reopened tabs and navigation will fail.
			gStartingUp = false;
			recentTabs.updateAll()
				.then(function() {
					handleCommand(command);
				});
		}
	});


	chrome.runtime.onConnect.addListener(function(port) {
		const connectTime = Date.now();

		var closedByEsc = false;

			// in newer versions of Chrome, reopened tabs don't trigger an
			// onActivated event, so the handler set in onStartup won't fire
			// until the first tab is manually activated.  set gStartingUp to
			// false here in case the user opens the menu before that happens.
		gStartingUp = false;
		popupIsOpen = true;

		port.onMessage.addListener(function(message) {
			closedByEsc = (message == "closedByEsc");
		});

		port.onDisconnect.addListener(function() {
			popupIsOpen = false;

			if (!closedByEsc && Date.now() - connectTime < MaxPopupLifetime) {
					// pass true so navigate() knows this event is coming from
					// a double press of the shortcut.  set addFromToggle so that
					// the onActivated listener calls add immediately instead of
					// debouncing it.  otherwise, quickly repeated double presses
					// would be ignored because the tab list wouldn't have been
					// updated yet.
				addFromToggle = true;
				recentTabs.navigate(-1, true);
				backgroundTracker.event("recents", "toggle");
			} else {
					// send a background "pageview", since the popup is now closed,
					// so that GA will track the time the popup was open
				backgroundTracker.pageview();
			}
		});
	});


	chrome.runtime.onUpdateAvailable.addListener(function(details) {
		try {
			backgroundTracker.event("extension", "update-available",
				details && details.version);
		} catch (e) {
			console.log(e);
		}
	});


	window.addEventListener("error", function(event) {
		backgroundTracker.exception(event, true);
	});


	window.log = function() {
		DEBUG && console.log.apply(console, arguments);
	};


	cp.management.getSelf()
		.then(function(info) {
			var installType = (info.installType == "development") ? "D" : "P",
				dimensions = {
					"dimension1": info.version,
					"dimension2": installType
				};

			backgroundTracker.set(dimensions);
			trackers.popup.set(dimensions);
			trackers.options.set(dimensions);

			backgroundTracker.pageview();
			backgroundTracker.timing("loading", "background", performance.now());
		})
		.then(function() {
				// pause the chain to wait for the installed promise to resolve,
				// which it will never do if the event doesn't fire.  if it does,
				// it should do so before we get here, but we use a promise just
				// in case it doesn't for some reason.
			return gInstalledPromise;
		})
		.then(function(reason) {
			backgroundTracker.event("extension", reason);
		});
});
