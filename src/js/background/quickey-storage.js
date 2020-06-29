define([
	"cp",
	"shared",
	"lib/objects-have-same-keys",
	"lib/decode",
	"./storage",
	"./get-default-settings",
	"./constants"
], function(
	cp,
	shared,
	objectsHaveSameKeys,
	decode,
	createStorage,
	getDefaultSettings,
	k
) {
	return shared("quickeyStorage", () => {
		function increment(
			value)
		{
			return parseInt(value) + 1;
		}


		function update(
			updater)
		{
			return async (data, version) => {
				await updater(data, version);

					// we added highlighting of new options in v8, so set the
					// lastSeenOptionsVersion to just before that
				if (version >= 7 && !Number.isInteger(data.lastSeenOptionsVersion)) {
					data.lastSeenOptionsVersion = 7;
				}

				return [data, increment(version)];
			};
		}


		function addDefaultSetting(
			...settings)
		{
			return async data => {
				const defaults = (await DefaultData).settings;

				settings.forEach(setting => {
					const {Key} = setting;
					const defaultValue = defaults[Key];

					if (typeof defaultValue == "undefined") {
						throw new Error(`addDefaultSetting(): no default value for "${setting}"`);
					} else {
						data.settings[Key] = defaultValue;
					}
				});
			};
		}


		const Updaters = {
			"3": update(data =>
			{
					// add installTime in v4
				data.installTime = Date.now();

					// we no longer need these values
				delete data.switchFromShortcut;
				delete data.lastShortcutTabID;
			}),
			"4": update(async data =>
			{
					// add settings in v5
				data.settings = (await DefaultData).settings;
			}),
			"5": update(async data =>
			{
					// add includeClosedTabs option and lastUsedVersion in
					// v6.  leave lastUsedVersion empty so the background
					// code can tell this was an update from an older version.
				await addDefaultSetting(k.IncludeClosedTabs)(data);
				data.lastUsedVersion = "";
			}),
			"6": update(addDefaultSetting(k.MarkTabsInOtherWindows)),
			"7": update(addDefaultSetting(k.ShowTabCount)),
			"8": update(addDefaultSetting(k.UsePinyin)),
			"9": update(async data =>
			{
					// since addDefaultSetting() returns a function, we have to
					// call it with the stored data passed in by update()
				await addDefaultSetting(
					k.RestoreLastQuery,
					k.ShowBookmarkPaths,
					k.HomeEndBehavior
				)(data);
				data.lastQuery = "";
			}),
			"10": update(async data =>
			{
				await addDefaultSetting(
					k.CurrentWindowLimitRecents,
					k.CurrentWindowLimitSearch
				)(data);
			})
		};
			// calculate the version by incrementing the highest key in the
			// Updaters hash, so that the version is automatically increased
			// when an updater is added.  use a proper numeric sort so that
			// once we go over 9, the order is correct.
		const CurrentVersion = increment(Object.keys(Updaters).sort((a, b) => a - b).pop());
		const DefaultSettings = getDefaultSettings();
		const DefaultData = Promise.all([
				cp.windows.getAll(),
				cp.tabs.query({})
			])
			.then(([windows, tabs]) => {
				let hanPattern;

					// our minimum Chrome version is 55, but the Unicode property
					// support was added in 64, so this may throw in older
					// browsers.  in that case, auto-detecting Chinese characters
					// won't work, but the user can always enable it manually.
				try { hanPattern = /\p{Script=Han}/u; } catch (e) {}

				if (k.Language.indexOf("zh") == 0) {
						// the browser is set to Chinese, so default this on
					DefaultSettings[k.UsePinyin.Key] = true;
				} else if (hanPattern) {
						// default usePinyin to true if any of the currently
						// open tabs have Chinese characters in their title/URL
					for (let i = 0, len = tabs.length; i < len; i++) {
						const {title, url} = tabs[i];

							// decode the URL, since Chinese characters in tab
							// URLs seem to get encoded when returned by the API
						if (hanPattern.test(title) || hanPattern.test(decode(url))) {
							DefaultSettings[k.UsePinyin.Key] = true;

							break;
						}
					}
				}

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
					lastQuery: "",
					previousTabIndex: -1,
					popupAdjustmentWidth: 0,
					popupAdjustmentHeight: 0,
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
