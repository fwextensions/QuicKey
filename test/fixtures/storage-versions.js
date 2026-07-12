	// era-accurate snapshots of what chrome.storage.local held at historical
	// storage versions, reconstructed from the git history of
	// quickey-storage.js (and its AMD-era predecessor).  each fixture is the
	// `data` value only; tests wrap it as { version, data, lastSavedFrom }.
	//
	// accuracy matters: validateUpdate() requires the *exact* current key
	// set after the updater chain runs, and several keys (previousTabIndex,
	// lastShortcutTime, escBehavior, shortcuts, ...) are never added by any
	// updater -- they've simply always existed.  a fixture with keys that a
	// real profile of that era didn't have would mask a failed migration,
	// and one missing keys a real profile did have would fake a failure.
	//
	// user-specific values (tab lists, customized settings) are deliberately
	// non-default, so the tests can prove migration preserves them instead
	// of resetting.

const tabs = {
	101: {
		id: 101,
		url: "https://one.example.com/",
		title: "One",
		windowId: 1,
		lastVisit: 1500000000000,
	},
	102: {
		id: 102,
		url: "https://two.example.com/",
		title: "Two",
		windowId: 1,
		lastVisit: 1500000001000,
	},
};

	// the settings object as first shipped (storage v5-v6, QuicKey 1.1.x):
	// spaceBehavior/escBehavior, the shortcuts map, and includeClosedTabs
	// (added by updater 5).  everything else arrived via later updaters.
	// escBehavior and the mruSelect shortcut are customized away from the
	// era defaults ("clear" and "w").
function earlySettings()
{
	const shortcuts = {
		mruSelect: "e",
		closeTab: "ctrl+w",
		moveTabLeft: "ctrl+[",
		moveTabRight: "ctrl+]",
		copyURL: "mod+c",
		copyTitleURL: "mod+shift+c",
	};

	return {
		spaceBehavior: "select",
		escBehavior: "close",
		includeClosedTabs: false,
		shortcuts: {
			mac: { ...shortcuts, closeTab: "cmd+ctrl+w" },
			win: { ...shortcuts },
		},
	};
}

export default {
		// pre-installTime, pre-settings era.  switchFromShortcut and
		// lastShortcutTabID are dropped by updater 3.
	3: {
		tabIDs: [101, 102],
		tabsByID: structuredClone(tabs),
		previousTabIndex: -1,
		lastShortcutTime: 0,
		lastStartupTime: 0,
		lastUpdateTime: 0,
		switchFromShortcut: false,
		lastShortcutTabID: null,
	},

		// installTime exists, settings don't yet: this is the version that
		// exercises updater 4 (settings come from the live defaults)
	4: {
		tabIDs: [101, 102],
		tabsByID: structuredClone(tabs),
		previousTabIndex: -1,
		lastShortcutTime: 0,
		lastStartupTime: 0,
		lastUpdateTime: 0,
		installTime: 1500000000000,
	},

		// early settings era (QuicKey 1.1.x): updater 5 has run, so
		// lastUsedVersion holds the manifest version of that install
	6: {
		tabIDs: [101, 102],
		tabsByID: structuredClone(tabs),
		previousTabIndex: -1,
		lastShortcutTime: 0,
		lastStartupTime: 0,
		lastUpdateTime: 0,
		installTime: 1500000000000,
		lastUsedVersion: "1.1.2",
		settings: earlySettings(),
	},

		// the era just before colorScheme (updater 13).  this fixture is the
		// schema-drift guard: if a key is ever added to createDefaultData()
		// or to the default settings *without* a matching updater, migrating
		// this fixture stops producing the current shape, validateUpdate()
		// wipes the (simulated) user's data, and the migration test fails.
	13: {
		tabIDs: [101, 102],
		tabsByID: structuredClone(tabs),
		previousTabIndex: -1,
		lastShortcutTime: 0,
		lastStartupTime: 1600000000000,
		lastUpdateTime: 1600000000000,
		installTime: 1500000000000,
		lastUsedVersion: "1.6.1",
		lastSeenOptionsVersion: 7,
		lastQuery: "docs",
		popupAdjustmentWidth: 0,
		popupAdjustmentHeight: 0,
		settings: {
			spaceBehavior: "both",
			escBehavior: "close",
			homeEndBehavior: "resultsList",
			hidePopupBehavior: "behind",
			markTabsInOtherWindows: true,
			includeClosedTabs: false,
			showTabCount: true,
			usePinyin: false,
			restoreLastQuery: true,
			showBookmarkPaths: true,
			currentWindowLimitRecents: false,
			currentWindowLimitSearch: false,
			navigateRecentsWithPopup: true,
			shortcuts: earlySettings().shortcuts,
		},
	},
};
