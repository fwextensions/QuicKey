define([
	"shared"
], function(
	shared
) {
	const IsMac = /Mac/i.test(navigator.platform);
	const IsEdge = /Edg\//i.test(navigator.userAgent);

	const languagePattern = /^(?<lang>[-a-z]+)-(?<locale>[a-z]+)$/i;
	const primaryLanguage = navigator.languages[0];
	const languageMatch = primaryLanguage.match(languagePattern);

	return shared("k", () => ({
		IsMac,
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
