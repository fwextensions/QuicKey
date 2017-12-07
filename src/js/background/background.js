	// if the popup is opened and closed within this time, switch to the
	// previous tab
const MaxPopupLifetime = 450;


var gStartingUp = false;


console.log("= load");

chrome.runtime.onStartup.addListener(function() {
	var timer = null;

	gStartingUp = true;

console.log("== onStartup");

	function onActivated(window) {
		clearTimeout(timer);

console.log("=== onActivated");

			// set a timer to debounce this event, since if many windows are open,
			// this will get called once for each active tab in each window on startup
		timer = setTimeout(function() {
			chrome.tabs.onActivated.removeListener(onActivated);

console.log("==== last onActivated");

			require([
				"recent-tabs"
			], function(
				recentTabs
			) {
					// the stored recent tab data will be out of date, since the tabs
					// will get new IDs when the app reloads each one
				return recentTabs.updateAll(window)
					.then(function() {
console.log("===== updateAll done");

						gStartingUp = false;
					});
			});
		}, 500);
	}

	chrome.tabs.onActivated.addListener(onActivated);
});


chrome.tabs.onActivated.addListener(function(event) {
	if (!gStartingUp) {
		require([
			"recent-tabs",
			"cp"
		], function(
			recentTabs,
			cp
		) {
			return cp.tabs.get(event.tabId)
				.then(recentTabs.add);
		});
	}
});


chrome.tabs.onRemoved.addListener(function(tabID, removeInfo) {
	if (!gStartingUp) {
		require([
			"recent-tabs"
		], function(
			recentTabs
		) {
			recentTabs.remove(tabID, removeInfo);
		});
	}
});


	// the onActivated event isn't fired when the user switches between
	// windows, so get the active tab in this window and store it
chrome.windows.onFocusChanged.addListener(function(windowID) {
	if (!gStartingUp && windowID != chrome.windows.WINDOW_ID_NONE) {
		require([
			"recent-tabs",
			"cp"
		], function(
			recentTabs,
			cp
		) {
			cp.tabs.query({ active: true, windowId: windowID })
				.then(function(tabs) {
					if (tabs.length) {
							// pass true to let addTab() know that this change
							// is from alt-tabbing between windows, not switching
							// tabs within a window
						recentTabs.add(tabs[0], true);
					}
				});
		});
	}
});


chrome.commands.onCommand.addListener(function(command) {
	require([
		"recent-tabs"
	], function(
		recentTabs
	) {
		if (command == "previous-tab") {
			recentTabs.toggleTab(-1);
		} else if (command == "next-tab") {
			recentTabs.toggleTab(1);
		}
	});
});


chrome.runtime.onConnect.addListener(function(port) {
	const connectTime = Date.now();

	port.onDisconnect.addListener(function() {
		if (Date.now() - connectTime < MaxPopupLifetime) {
			require([
				"recent-tabs"
			], function(
				recentTabs
			) {
				recentTabs.toggleTab(-1, true);
			});
		}
	});
});


window.log = function() {
	console.log.apply(console, arguments);
};
