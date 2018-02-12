	// if the popup is opened and closed within this time, switch to the
	// previous tab
const MaxPopupLifetime = 450,
	TabActivatedDelay = 750,
	MinTabDwellTime = 750,
	RestartDelay = 10 * 1000;


var gStartingUp = false;


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
	gStartingUp = true;

DEBUG && console.log("== onStartup");


	const onActivated = debounce(function()
	{
		chrome.tabs.onActivated.removeListener(onActivated);

DEBUG && console.log("==== last onActivated");

		require([
			"background/recent-tabs"
		], function(
			recentTabs
		) {
// TODO: move this into a global function set inside the main require()
				// the stored recent tab data will be out of date, since the tabs
				// will get new IDs when the app reloads each one
			return recentTabs.updateAll()
				.then(function() {
DEBUG && console.log("===== updateAll done");

					gStartingUp = false;
				});
		});
	}, TabActivatedDelay);


		// before Chrome 63 or so, when relaunching the browser, all the previously
		// open tabs would trigger onActivated events, and we wanted to ignore
		// those until Chrome settled down.  now it seems like neither tab nor
		// window activation events are triggered during startup, so fire the
		// event handler manually, so even if no other events are fired, we're
		// guaranteed to call updateAll() and flip gStartingUp back to false.
	onActivated();

	chrome.tabs.onActivated.addListener(onActivated);
});


require([
	"background/recent-tabs",
	"background/page-trackers",
	"cp"
], function(
	recentTabs,
	pageTrackers,
	cp
) {
	var popupIsOpen = false,
		addFromToggle = false,
		backgroundTracker = pageTrackers.background,
		popupTracker = pageTrackers.popup,
		lastWindowID;

	window.tracker = popupTracker;


	function addTab(
		data)
	{
		if (data.tabId) {
			return cp.tabs.get(data.tabId)
				.then(recentTabs.add);
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
			debouncedAddTab(event);
		}
	}


	chrome.tabs.onActivated.addListener(function(event) {
		if (!gStartingUp) {
			onTabChanged(event);
		}
	});


	chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
		if (!gStartingUp) {
			recentTabs.remove(tabId, removeInfo);
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
		if (command == "1-previous-tab") {
			recentTabs.toggleTab(-1);
			backgroundTracker.event("recents", "previous");
		} else if (command == "2-next-tab") {
			recentTabs.toggleTab(1);
			backgroundTracker.event("recents", "next");
		}
	});


	chrome.runtime.onConnect.addListener(function(port) {
		const connectTime = Date.now();

		var closedByEsc = false;

		popupIsOpen = true;

		port.onMessage.addListener(function(message) {
			closedByEsc = (message == "closedByEsc");
		});

		port.onDisconnect.addListener(function() {
			popupIsOpen = false;

			if (!closedByEsc && Date.now() - connectTime < MaxPopupLifetime) {
					// pass true so toggleTab() knows this toggle is coming from
					// a double press of the shortcut.  set addFromToggle so that
					// the onActivated listener calls add immediately instead of
					// debouncing it.  otherwise, quickly repeated double presses
					// would be ignored because the tab list wouldn't have been
					// updated yet.
				addFromToggle = true;
				recentTabs.toggleTab(-1, true);
				backgroundTracker.event("recents", "toggle");
			} else {
					// send a background "pageview", since the popup is now closed,
					// so that GA will track the time the popup was open
				backgroundTracker.pageview();
			}
		});
	});


	chrome.runtime.onUpdateAvailable.addListener(function(details) {
		function restartExtension()
		{
			if (!popupIsOpen) {
console.log("=== reloading for update");
//DEBUG && console.log("=== reloading");
				chrome.runtime.reload();
			} else {
				setTimeout(restartExtension, RestartDelay);
			}
		}

		console.log("onUpdateAvailable", details);
//		DEBUG && console.log("onUpdateAvailable", details);

		restartExtension();
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
			popupTracker.set(dimensions);

			backgroundTracker.pageview();
			backgroundTracker.timing("loading", "background", performance.now());
		});
});
