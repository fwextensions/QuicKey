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


	return shared("quickeyStorage", () => {
		const Updaters = {
			"3": (data, version) =>
			{
					// add installTime in v4
				data.installTime = Date.now();

					// we no longer need these values
				delete data.switchFromShortcut;
				delete data.lastShortcutTabID;

				return [data, increment(version)];
			},
			"4": async (data, version) =>
			{
					// add settings in v5
				data.settings = (await DefaultData).settings;

				return [data, increment(version)];
			},
			"5": async (data, version) =>
			{
					// add includeClosedTabs option and lastUsedVersion in
					// v6.  leave lastUsedVersion empty so the background
					// code can tell this was an update from an older version.
				data.settings[k.IncludeClosedTabs.Key] =
					(await DefaultData).settings[k.IncludeClosedTabs.Key];
				data.lastUsedVersion = "";

				return [data, increment(version)];
			},
			"6": async (data, version) =>
			{
					// add markTabsInOtherWindows option
				data.settings[k.MarkTabsInOtherWindows.Key] =
					(await DefaultData).settings[k.MarkTabsInOtherWindows.Key];

				return [data, increment(version)];
			},
			"7": async (data, version) =>
			{
					// add showTabCount option
				data.settings[k.ShowTabCount.Key] =
					(await DefaultData).settings[k.ShowTabCount.Key];

					// we're updating from 7 to 8, so 7 is the last version of
					// options that the user might have seen
				data.lastSeenOptionsVersion = 7;

				return [data, increment(version)];
			}
		};
			// calculate the version by incrementing the highest key in the
			// Updaters hash, so that the version is automatically increased
			// when an updater is added.  use a proper numeric sort so that
			// once we go over 9, the order is correct.
		const CurrentVersion = increment(Object.keys(Updaters).sort((a, b) => a - b).pop());
		const DefaultSettings = getDefaultSettings();
		const DefaultData = cp.windows.getAll()
			.then(windows => {
				DefaultSettings[k.MarkTabsInOtherWindows.Key] = windows.length < 4;

				return {
					installTime: Date.now(),
					lastShortcutTime: 0,
					lastStartupTime: 0,
					lastUpdateTime: 0,
					lastUsedVersion: "",
						// set this to the current storage version so that we
						// don't show the red badge on a new install
					lastSeenOptionsVersion: CurrentVersion,
					previousTabIndex: -1,
					settings: DefaultSettings,
					tabIDs: [],
					tabsByID: {}
				};
			});


		return createStorage({
				// calculate the version by incrementing the highest key in the
				// Updaters hash, so that the version is automatically increased
				// when an updater is added.  use a proper numeric sort so that
				// once we go over 9, the order is correct.
			version: CurrentVersion,
			updaters: Updaters,


			getDefaultData: async function()
			{
					// we only want to get the tabs in the current window because
					// only the currently active tab is "recent" as far as we know
				const tabs = await cp.tabs.query({ active: true, currentWindow: true, windowType: "normal" });
				const tab = tabs && tabs[0];
				const data = JSON.parse(JSON.stringify(await DefaultData));

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
			},


			validateUpdate: async function(
				data)
			{
				const defaults = await DefaultData;

					// first check the top-level keys, but don't check sub-objects
					// because we have the tabsByID hash, and we don't care what
					// keys it contains.  then deeply check that settings has
					// the right shape.
				return objectsHaveSameKeys(defaults, data, false) &&
					objectsHaveSameKeys(defaults.settings, data.settings, true);
			}
		});
	});
});
