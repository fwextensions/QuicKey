	// we can't add this listener inside the require below because that's
	// called asynchronously, and the startup event will have already fired
	// by the time the require callback runs
chrome.runtime.onStartup.addListener(function() {
console.log("startup");
	require([
		"recent-tabs"
	], function(
		recentTabs
	) {
			// the stored recent tab data will be out of date, since the tabs
			// will likely get new IDs when reloaded
		return recentTabs.updateAll();
	});
});


require([
	"storage",
	"recent-tabs",
	"cp"
], function(
	storage,
	recentTabs,
	cp
) {
	chrome.tabs.onActivated.addListener(function(event) {
		return cp.tabs.get(event.tabId)
			.then(function(tab) {
//console.log("onActivated", tab.id);

				recentTabs.add(tab);
			});
	});


	chrome.tabs.onRemoved.addListener(function(tabID, removeInfo) {
//console.log("onRemoved", tabID);

		recentTabs.remove(tabID, removeInfo);
	});


	chrome.tabs.onUpdated.addListener(function(tabID, changeInfo) {
//console.log("onUpdated", tabID);

		recentTabs.update(tabID, changeInfo);
	});


		// the onActivated event isn't fired when the user switches between
		// windows, so get the active tab in this window and store it
	chrome.windows.onFocusChanged.addListener(function(windowID) {
		if (windowID != chrome.windows.WINDOW_ID_NONE) {
			cp.tabs.query({ active: true, windowId: windowID })
				.then(function(tabs) {
					if (tabs.length) {
//console.log("onFocusChanged", windowID, tabs[0].id, tabs[0].url);

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
			recentTabs.toggleTab("previous");
		}
	});


	window.log = function() {
		console.log.apply(console, arguments);
	}
});
