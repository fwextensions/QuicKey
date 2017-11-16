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
	const MaxSwitchDelay = 750;


	chrome.tabs.onActivated.addListener(function(event) {
		return cp.tabs.get(event.tabId)
			.then(function(tab) {
console.log("onActivated", tab.id);

				recentTabs.add(tab);
			});
	});


	chrome.tabs.onRemoved.addListener(function(tabID, removeInfo) {
console.log("onRemoved", tabID);

		recentTabs.remove(tabID, removeInfo);
	});


	chrome.tabs.onUpdated.addListener(function(tabID, changeInfo) {
console.log("onUpdated", tabID);

		recentTabs.update(tabID, changeInfo);
	});


		// the onActivated event isn't fired when the user switches between
		// windows, so get the active tab in this window and store it
	chrome.windows.onFocusChanged.addListener(function(windowID) {
		if (windowID != chrome.windows.WINDOW_ID_NONE) {
			cp.tabs.query({ active: true, windowId: windowID })
				.then(function(tabs) {
					if (tabs.length) {
console.log("onFocusChanged", windowID, tabs[0].id, tabs[0].url);

							// pass true to let addTab() know that this change
							// is from alt-tabbing between windows, not switching
							// tabs within a window
						recentTabs.add(tabs[0], true);
					}
				});
		}
	});


// TODO: move this to recentTabs
	chrome.commands.onCommand.addListener(function(command) {
		if (command == "previous-tab") {
			storage.getAll()
				.then(function(storage) {
					var tabIDs = storage.tabIDs,
						tabIDCount = tabIDs.length,
						now = Date.now(),
							// set a flag so we know when the previous tab is
							// re-activated that it was caused by us, not the
							// user, so that it doesn't remove tabs based on
							// dwell time
						newStorage = {
							switchFromShortcut: true,
							lastShortcutTime: now,
							previousTabIndex: -1
						},
						previousTabIndex = tabIDCount - 2,
						previousTabID,
						previousWindowID;

					if (tabIDCount > 1) {
						if (tabIDCount > 2 && !isNaN(storage.lastShortcutTime) &&
								now - storage.lastShortcutTime < MaxSwitchDelay) {
							if (storage.previousTabIndex > -1) {
								previousTabIndex = (storage.previousTabIndex - 1 + tabIDCount) % tabIDCount;
							} else {
								previousTabIndex = tabIDCount - 3;
							}

// TODO: rearrange tabs so two most recently visited are at the end of the list

							newStorage.previousTabIndex = previousTabIndex;
						}

						previousTabID = tabIDs[previousTabIndex];
						previousWindowID = storage.tabsByID[previousTabID].windowId;

						chrome.storage.local.set(newStorage);
						chrome.tabs.update(previousTabID, { active: true });

						if (previousWindowID != chrome.windows.WINDOW_ID_CURRENT) {
							chrome.windows.update(previousWindowID, { focused: true });
						}
					}
				});
		}
	});


	window.log = function() {
		console.log.apply(console, arguments);
	}
});
