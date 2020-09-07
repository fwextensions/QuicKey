define([
	"shared"
], function(
	shared
) {
		// use navigator values instead of chrome.runtime.getPlatformInfo() so
		// we don't have to await the response everywhere constants are used
	const {userAgent, platform, languages} = navigator;
	const IsMac = /Mac/i.test(platform);
	const IsLinux = /Linux/i.test(platform);
	const IsEdge = /Edg\//i.test(userAgent);

	const languagePattern = /^(?<lang>[-a-z]+)-(?<locale>[a-z]+)$/i;
	const primaryLanguage = languages[0];
	const languageMatch = primaryLanguage.match(languagePattern);

	return shared("k", () => ({
		IsMac,
		IsLinux,
		Platform: IsMac ? "mac" : "win",
		Language: languageMatch && languageMatch.groups.lang || primaryLanguage,
			// this will get overridden in background.js if we're in dev mode
		IsDev: false,
		IsEdge,
		IncognitoNameUC: IsEdge ? "InPrivate" : "Incognito",
		IncognitoNameLC: IsEdge ? "InPrivate" : "incognito",
		MinTabDwellTime: 1250,
		CommandIDs: {
			OpenPopupCommand: "010-open-popup-window",
			FocusPopupCommand: "020-focus-search",
			PreviousTabCommand: "1-previous-tab",
			NextTabCommand: "2-next-tab",
			ToggleTabsCommand: "30-toggle-recent-tabs"
		},
		SpaceBehavior: {
			Key: "spaceBehavior",
			Select: "select",
			Space: "space"
		},
		EscBehavior: {
			Key: "escBehavior",
			Clear: "clear",
			Close: "close"
		},
		HomeEndBehavior: {
			Key: "homeEndBehavior",
			ResultsList: "resultsList",
			SearchBox: "searchBox"
		},
		HidePopupBehavior: {
			Key: "hidePopupBehavior",
			Offscreen: "offscreen",
			Behind: "behind",
			Tab: "tab",
			Minimize: "minimize"
		},
		MarkTabsInOtherWindows: {
			Key: "markTabsInOtherWindows"
		},
		IncludeClosedTabs: {
			Key: "includeClosedTabs"
		},
		ShowTabCount: {
			Key: "showTabCount"
		},
		UsePinyin: {
			Key: "usePinyin"
		},
		RestoreLastQuery: {
			Key: "restoreLastQuery"
		},
		ShowBookmarkPaths: {
			Key: "showBookmarkPaths"
		},
		CurrentWindowLimitRecents: {
			Key: "currentWindowLimitRecents"
		},
		CurrentWindowLimitSearch: {
			Key: "currentWindowLimitSearch"
		},
		Shortcuts: {
			Key: "shortcuts",
			MRUSelect: "mruSelect",
			CloseTab: "closeTab",
			MoveTabLeft: "moveTabLeft",
			MoveTabRight: "moveTabRight",
			CopyURL: "copyURL",
			CopyTitleURL: "copyTitleURL"
		}
	}));
});
