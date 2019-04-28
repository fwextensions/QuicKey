define([
	"cp",
	"shared",
	"./storage",
	"./get-default-settings",
	"./constants"
], function(
	cp,
	shared,
	createStorage,
	getDefaultSettings,
	k
) {
	function increment(
		value)
	{
		return parseInt(value) + 1;
	}


		// store a single storage instance on the background page, so that any
		// module that requires this one will use the same storage mutex and the
		// same in-memory data
	return shared("quickeyStorage", function() {
		const StorageVersion = 6;
		const DefaultSettings = getDefaultSettings();


		return createStorage({
			version: StorageVersion,
			getDefaultData: function()
			{
					// we only want to get the tabs in the current window because
					// only the currently active tab is "recent" as far as we know
				return cp.tabs.query({ active: true, currentWindow: true, windowType: "normal" })
					.then(function(tabs) {
						const data = {
							tabIDs: [],
							tabsByID: {},
							previousTabIndex: -1,
							lastShortcutTime: 0,
							lastStartupTime: 0,
							lastUpdateTime: 0,
							installTime: Date.now(),
							settings: DefaultSettings
						};
						const tab = tabs && tabs[0];

						if (tab) {
								// store now as the last visit of the current tab so
								// that if the user switches to a different tab, this
								// one will be shown as a recent one in the menu.
								// ideally, this would be added via recentTabs.add(),
								// but that module also depends on this one, so there
								// would be a circular reference.
							tab.lastVisit = Date.now();
							data.tabIDs.push(tab.id);
							data.tabsByID[tab.id] = tab;
						}

						return data;
					});
			},
			updaters: {
				"3": function(
					data,
					version)
				{
						// add installTime in v4
					data.installTime = Date.now();

						// we no longer need these values
					delete data.switchFromShortcut;
					delete data.lastShortcutTabID;

					return [increment(version), data];
				},
				"4": function(
					data,
					version)
				{
						// add settings in v5
					data.settings = DefaultSettings;

					return [increment(version), data];
				},
				"5": function(
					data,
					version)
				{
						// add includeClosedTabs option and lastUsedVersion in v6
					data.settings[k.IncludeClosedTabs.Key] = DefaultSettings[k.IncludeClosedTabs.Key];
					data.lastUsedVersion = chrome.runtime.getManifest().version;

					return [increment(version), data];
				}
			}
		});
	});
});
