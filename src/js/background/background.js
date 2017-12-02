var gStartingUp = false;


	// called asynchronously, and the startup event will have already fired
	// by the time the require callback runs
chrome.runtime.onStartup.addListener(function() {
	var timer = null;

	gStartingUp = true;


	function onActivated(window) {
		clearTimeout(timer);

			// set a timer to debounce this event, since if many windows are open,
			// this will get called once for each active tab in each window on startup
		timer = setTimeout(function() {
			chrome.tabs.onActivated.removeListener(onActivated);

			require([
				"recent-tabs"
			], function(
				recentTabs
			) {
					// the stored recent tab data will be out of date, since the tabs
					// will get new IDs when the app reloads each one
				return recentTabs.updateAll(window)
					.then(function() {
						gStartingUp = false;
					});
			});
		}, 500);
	}

	chrome.tabs.onActivated.addListener(onActivated);
});


require([
	"recent-tabs",
	"cp"
], function(
	recentTabs,
	cp
) {
		// if the popup is opened and closed within this time, switch to the
		// previous tab
	const MaxPopupLifetime = 400;


	chrome.tabs.onActivated.addListener(function(event) {
		if (!gStartingUp) {
			return cp.tabs.get(event.tabId)
				.then(recentTabs.add)
		}
	});


	chrome.tabs.onRemoved.addListener(function(tabID, removeInfo) {
		if (!gStartingUp) {
			recentTabs.remove(tabID, removeInfo);
		}
	});


		// the onActivated event isn't fired when the user switches between
		// windows, so get the active tab in this window and store it
	chrome.windows.onFocusChanged.addListener(function(windowID) {
		if (!gStartingUp && windowID != chrome.windows.WINDOW_ID_NONE) {
			cp.tabs.query({ active: true, windowId: windowID })
				.then(function(tabs) {
					if (tabs.length) {
							// pass true to let addTab() know that this change
							// is from alt-tabbing between windows, not switching
							// tabs within a window
						recentTabs.add(tabs[0], true);
					}
				});
		}
	});


	chrome.commands.onCommand.addListener(function(command) {
		if (command == "previous-tab") {
			recentTabs.toggleTab(-1);
		} else if (command == "next-tab") {
			recentTabs.toggleTab(1);
		}
	});


	chrome.runtime.onConnect.addListener(function(port) {
		const connectTime = Date.now();

		port.onDisconnect.addListener(function() {
			if (Date.now() - connectTime < MaxPopupLifetime) {
				recentTabs.toggleTab(-1, true);
			}
		});
	});


	window.log = function() {
		console.log.apply(console, arguments);
	}
});
