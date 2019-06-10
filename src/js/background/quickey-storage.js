define([
	"cp",
	"shared",
	"lib/objects-have-same-keys",
	"./storage",
	"./get-default-settings",
	"./constants"
], function(
	cp,
	shared,
	objectsHaveSameKeys,
	createStorage,
	getDefaultSettings,
	k
) {
	function increment(
		value)
	{
		return parseInt(value) + 1;
	}


	return shared("quickeyStorage", function() {
		const StorageVersion = 6;
		const DefaultSettings = getDefaultSettings();
		const DefaultData = {
			installTime: Date.now(),
			lastShortcutTime: 0,
			lastStartupTime: 0,
			lastUpdateTime: 0,
			lastUsedVersion: "",
			previousTabIndex: -1,
			settings: DefaultSettings,
			tabIDs: [],
			tabsByID: {}
		};


		return createStorage({
			version: StorageVersion,


			getDefaultData: function()
			{
					// we only want to get the tabs in the current window because
					// only the currently active tab is "recent" as far as we know
				return cp.tabs.query({ active: true, currentWindow: true, windowType: "normal" })
					.then(function(tabs) {
						const data = JSON.parse(JSON.stringify(DefaultData));
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

					return [data, increment(version)];
				},
				"4": function(
					data,
					version)
				{
						// add settings in v5
					data.settings = DefaultSettings;

					return [data, increment(version)];
				},
				"5": function(
					data,
					version)
				{
						// add includeClosedTabs option and lastUsedVersion in
						// v6.  leave lastUsedVersion empty so the background
						// code can tell this was an update from an older version.
					data.settings[k.IncludeClosedTabs.Key] = DefaultSettings[k.IncludeClosedTabs.Key];
					data.lastUsedVersion = "";

					return [data, increment(version)];
				}
			},


			validateUpdate: function(
				data)
			{
					// first check the top-level keys, but don't check sub-objects
					// because we have the tabsByID hash, and we don't care what
					// keys it contains.  then deeply check that settings has
					// the right shape.
				return objectsHaveSameKeys(DefaultData, data, false) &&
					objectsHaveSameKeys(DefaultData.settings, data.settings, true);
			}
		});
	});
});
