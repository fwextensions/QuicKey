define([
	"cp",
	"background/storage"
], function(
	cp,
	createStorage
) {
	const StorageVersion = 2;


	return createStorage(StorageVersion,
		function() {
				// we only want to get the tabs in the current window because
				// only the currently active tab is "recent" as far as we know
			return cp.tabs.query({ active: true, currentWindow: true, windowType: "normal" })
				.then(function(tabs) {
					var data = {
							tabIDs: [],
							tabsByID: {},
							previousTabIndex: -1,
							switchFromShortcut: false,
							lastShortcutTime: 0,
							lastStartupTime: 0,
							lastUpdateTime: 0,
							newTabsCount: []
						},
						tab = tabs && tabs[0];

					if (tab) {
						data.tabIDs.push(tab.id);
						data.tabsByID[tab.id] = tab;
					}

					return data;
				});
		}
	);
});
