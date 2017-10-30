require([
	"storage",
	"cp"
], function(
	storage,
	cp
) {
	chrome.tabs.onActivated.addListener(function(event) {
		cp.tabs.get(event.tabId)
			.then(function(tab) {
				storage.addTab(tab);
			});
	});


	chrome.tabs.onRemoved.addListener(function(tabID, removeInfo) {
console.log("closing", tabID);

		storage.removeTab(tabID, removeInfo);
	});


		// the onActivated event isn't fired when windows are switched between,
		// so get the active tab in this window and store it
	chrome.windows.onFocusChanged.addListener(function(windowID) {
		if (windowID != chrome.windows.WINDOW_ID_NONE) {
			cp.tabs.query({ active: true, windowId: windowID })
				.then(function(tabs) {
					if (tabs.length) {
console.log("active", windowID, tabs[0].id, tabs[0].url);

						storage.addTab(tabs[0]);
					}
				});
		}
	});


	chrome.commands.onCommand.addListener(function(command) {
		if (command == "previous-tab") {
			storage.getAll()
				.then(function(storage) {
					var tabIDs = storage.tabIDs,
						previousTabID,
						previousWindowID;

					if (tabIDs.length > 1) {
						previousTabID = tabIDs[tabIDs.length - 2];
						previousWindowID = storage.tabsByID[previousTabID].windowID;

							// set a flag so we know when the previous tab is
							// re-activated that it was caused by us, not the
							// user, so that it doesn't remove tabs based on
							// dwell time
						chrome.storage.local.set({ switchFromShortcut: true });
						chrome.tabs.update(previousTabID, { active: true });

						if (previousWindowID != chrome.windows.WINDOW_ID_CURRENT) {
							chrome.windows.update(previousWindowID, { focused: true });
						}
					}
				});
		}
	});
});
