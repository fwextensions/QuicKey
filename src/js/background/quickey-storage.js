import objectsHaveSameKeys from "@/lib/objects-have-same-keys";
import decode from "@/lib/decode";
import log from "./persistent-log";
import { createStorage } from "./storage";
import getDefaultSettings from "./get-default-settings";
import * as k from "./constants";


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
		const defaults = (await getDefaultDataPromise()).settings;

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
	3: update(data =>
	{
			// add installTime in v4
		data.installTime = Date.now();

			// we no longer need these values
		delete data.switchFromShortcut;
		delete data.lastShortcutTabID;
	}),
	4: update(async data =>
	{
			// add settings in v5
		data.settings = (await getDefaultDataPromise()).settings;
	}),
	5: update(async data =>
	{
			// add includeClosedTabs option and lastUsedVersion in
			// v6.  leave lastUsedVersion empty so the background
			// code can tell this was an update from an older version.
		await addDefaultSetting(k.IncludeClosedTabs)(data);
		data.lastUsedVersion = "";
	}),
	6: update(addDefaultSetting(k.MarkTabsInOtherWindows)),
	7: update(addDefaultSetting(k.ShowTabCount)),
	8: update(addDefaultSetting(k.UsePinyin)),
	9: update(async data =>
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
	10: update(async data =>
	{
		await addDefaultSetting(
			k.CurrentWindowLimitRecents,
			k.CurrentWindowLimitSearch
		)(data);
	}),
	11: update(async data =>
	{
		await addDefaultSetting(
			k.HidePopupBehavior,
			k.NavigateRecentsWithPopup
		)(data);
		data.popupAdjustmentWidth = 0;
		data.popupAdjustmentHeight = 0;
	}),
		// this one resets an existing setting to the default, rather than
		// adding a new one, since the Both option didn't exist before v13.
		// go through addDefaultSetting() anyway, like every other updater, so
		// that upgraded profiles can't drift away from what a fresh install
		// gets if the default is ever changed again.
	12: update(addDefaultSetting(k.SpaceBehavior)),
	13: update(async data =>
	{
		data.colorScheme = "light";
	}),
		// only a new install seeds its recents from Chrome's lastAccessed
		// times, so an existing profile has never shown the banner explaining
		// that order, and never should.  start it at the limit, which is the
		// same state a profile lands in once the banner has run its course.
	14: update(async data =>
	{
		data.seededRecentsBannerCount = k.MaxSeededRecentsBannerDisplays;

		await addDefaultSetting(k.MarkSuspendedTabs)(data);
	}),
};
	// calculate the version by incrementing the highest key in the
	// Updaters hash, so that the version is automatically increased
	// when an updater is added.  use a proper numeric sort so that
	// once we go over 9, the order is correct.
const CurrentVersion = increment(Object.keys(Updaters).sort((a, b) => a - b).pop());
const DefaultSettings = getDefaultSettings();
let defaultDataPromise;


function createDefaultData()
{
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
		colorScheme: "light",
			// default to the limit, so the banner stays hidden unless
			// seedRecents() actually has something to seed the list with
		seededRecentsBannerCount: k.MaxSeededRecentsBannerDisplays,
		settings: DefaultSettings,
		tabIDs: [],
		tabsByID: {}
	};
}


	// tuning the default settings requires querying all the open windows and
	// tabs, which can be slow when there are hundreds of tabs.  the defaults
	// are only needed on a new install or a storage version update, so do the
	// queries lazily, instead of on every startup of the worker or popup.
	// enumerating every tab is the slow part on a machine with thousands of
	// them, so a caller that has already done it can hand the results in rather
	// than making us query them all over again.
function getDefaultDataPromise(
	queriedWindows,
	queriedTabs)
{
	if (!defaultDataPromise) {
		defaultDataPromise = Promise.all([
			queriedWindows ?? chrome.windows.getAll(),
			queriedTabs ?? chrome.tabs.query({})
		])
			.then(([windows, tabs]) => {
				let hanPattern;

					// our minimum Chrome version used to be 55, but the Unicode
					// property support was added in 64, so this may have thrown in
					// older browsers, but the try/catch isn't really needed now
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

					// mark tabs in other windows if there are 3 or fewer windows
					// open, as someone with lots of open windows is probably
					// jumping between them frequently, so the icon is less relevant
				DefaultSettings[k.MarkTabsInOtherWindows.Key] = windows.length < 4;

					// log what we tuned from, since a reset that happens during
					// startup can see the browser before the windows have been
					// restored, which makes both of these counts too low
				log("tuning defaults from",
					windows.length, "windows and", tabs.length, "tabs");

				return createDefaultData();
			});
	}

	return defaultDataPromise;
}


	// on a brand-new install we have no history of our own, so the recents
	// list would otherwise be empty until the user switched tabs a few times.
	// Chrome 121+ puts a lastAccessed time on each tab -- "the last time the
	// tab became active in its window" -- which is the same thing our own
	// lastVisit tracking records, so it's a reasonable seed for the ordering.
	//
	// it isn't reliable enough to use beyond this one-time seed, though:
	// discarding a tab can drop the value, moving a tab can corrupt it, it's
	// omitted from the tab objects passed to the tabs events, and a tab that
	// was never activated just reports when it was created.  so we only use it
	// to pick an initial order, and let recent-tabs.js take over from there.
function seedRecents(
	data,
	tabs,
	activeTab)
{
	const seedable = [];
	const untimed = [];

	tabs.forEach(tab => {
			// skip the extension's own popups, and the current tab, which the
			// caller adds after us so that it lands at the end of the list
		if (tab.url?.includes(k.PopupURL) || (activeTab && tab.id === activeTab.id)) {
			return;
		}

		if (typeof tab.lastAccessed === "number") {
			seedable.push(tab);
		} else {
				// a discarded tab, a tab that got confused by being moved, or
				// a pre-121 Chrome.  we don't know when it was last seen, so
				// rather than dropping it, sort it below the tabs we do know
				// about, in the order the query returned it.
			untimed.push(tab);
		}
	});

	seedable.sort((a, b) => a.lastAccessed - b.lastAccessed);

		// tabIDs runs oldest to newest, so the unknown tabs go in front
	const orderedTabs = untimed.concat(seedable)
			// leave room for the current tab the caller pushes on after us
		.slice(-(k.MaxRecentTabs - 1));
		// keep the synthesized times for the unknown tabs below the real ones,
		// since getAll() sorts the menu by lastVisit rather than by tabIDs
	const oldestTime = seedable.length ? seedable[0].lastAccessed : Date.now();

	orderedTabs.forEach((tab, i) => {
		const index = orderedTabs.length - i;

		tab.lastVisit = typeof tab.lastAccessed === "number"
			? tab.lastAccessed
			: oldestTime - index;
		data.tabIDs.push(tab.id);
		data.tabsByID[tab.id] = tab;
	});

		// this ordering is a guess, so let the popup explain that to the user
		// for the first few times it's opened.  a one-tab install has nothing
		// to explain, so leave the count at the limit in that case.
	if (orderedTabs.length) {
		data.seededRecentsBannerCount = 0;
	}
}


export default createStorage({
	name: "QuicKey",
	version: CurrentVersion,
	updaters: Updaters,


		// previousData is passed only by a recovery reset, and is the data that
		// failed to update or validate
	getDefaultData: async function(
		previousData)
	{
		const [activeTabs, allTabs, windows] = await Promise.all([
				// we need the current window's active tab separately, since a
				// query over all the windows can't tell us which one is current
			chrome.tabs.query({ active: true, currentWindow: true, windowType: "normal" }),
				// query every tab, rather than just the ones in normal windows,
				// so that this one enumeration can serve both the settings
				// tuning below and the seeding further down
			chrome.tabs.query({}),
			chrome.windows.getAll()
		]);
		const tab = activeTabs && activeTabs[0];
			// pass in what we just queried, so the tuning doesn't enumerate
			// every tab a second time.  if an updater already ran this, it's
			// memoized and the arguments are ignored, which is also fine.
		const data = JSON.parse(JSON.stringify(await getDefaultDataPromise(windows, allTabs)));
			// a tab only knows its window's ID, not its type, so we need the
			// windows to tell which tabs are in normal ones
		const normalWindowIDs = new Set(windows
			.filter(({type}) => type == "normal")
			.map(({id}) => id)
		);

			// we have no history of our own yet, so seed the recents from the
			// open tabs, ordered by Chrome's lastAccessed times
		seedRecents(data, allTabs.filter(({windowId}) => normalWindowIDs.has(windowId)), tab);

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

			// a recovery reset isn't a new install: the data it's replacing was
			// valid enough to have a version.  the corruption we've seen is
			// always in the tab data, which rebuilding is the whole point of the
			// reset, but the settings are the part the user tuned by hand, and
			// there's no reason to make them do it again.  the defaults we just
			// built are also tuned from the window count, which is unreliable
			// here -- a reset during startup can run before the windows have
			// been restored -- so the stored settings are the better source even
			// when nothing was hand-tuned.
			//
			// only keep them if they still pass the same deep shape check
			// validateUpdate() applies, so settings that are themselves the
			// problem still get reset along with everything else.
		if (previousData?.settings
				&& objectsHaveSameKeys(data.settings, previousData.settings, true)) {
			data.settings = previousData.settings;

				// this is the same profile it was before the reset, so carry
				// its install date forward rather than dating it to whenever
				// the corruption happened to be noticed.  only if it really is
				// a date, though: the top level is what failed validation, so
				// nothing up here can be assumed, and writing a bad value back
				// would fail validation again on the next startup and reset in
				// a loop.
			const keepInstallTime = typeof previousData.installTime == "number"
				&& previousData.installTime > 0;

			if (keepInstallTime) {
				data.installTime = previousData.installTime;
			}

			log("RESET: keeping the existing settings",
				keepInstallTime ? "and install time" : "");
		}

		return data;
	},


	validateUpdate: async function(
		data)
	{
			// only the shape of the defaults matters for validation, so build
			// them synchronously, rather than paying for the windows and tabs
			// queries in getDefaultDataPromise() on every startup
		const defaults = createDefaultData();

			// first check the top-level keys, but don't check sub-objects
			// because we have the tabsByID hash, and we don't care what
			// keys it contains.  then deeply check that settings has
			// the right shape.
		return objectsHaveSameKeys(defaults, data, false) &&
			objectsHaveSameKeys(defaults.settings, data.settings, true);
	},

		// the only damage worth repairing is an unexpected top-level key, which
		// is almost always a bug leaking one of its own values into the object
		// handed to storage.set() -- pendingCount did exactly that in a492a9d
		// and cost a profile.  dropping it keeps the recents and everything else
		// the user cares about, where validation would otherwise treat it the
		// same as real corruption and reset.
		//
		// deliberately narrow: a *missing* key means an updater didn't run or
		// didn't finish, which is a genuine failure, and a wrong-shaped settings
		// object is not something we can guess our way out of.  both still fall
		// through to the reset.
	repairUpdate: async function(
		data)
	{
		const defaults = createDefaultData();
		const strayKeys = Object.keys(data)
			.filter((key) => !(key in defaults));

		if (!strayKeys.length) {
			return;
		}

		const repaired = { ...data };

		strayKeys.forEach((key) => delete repaired[key]);

		return repaired;
	}
});
