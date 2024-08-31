	// use navigator values instead of chrome.runtime.getPlatformInfo() so
	// we don't have to await the response everywhere constants are used
const {userAgent, platform, languages} = navigator;
const languagePattern = /^(?<lang>[-a-z]+)-(?<locale>[a-z]+)$/i;
const primaryLanguage = languages[0];
const languageMatch = primaryLanguage.match(languagePattern);


export const { version: Version } = chrome.runtime.getManifest();
export const IsMac = /Mac/i.test(platform);
export const IsLinux = /Linux/i.test(platform);
export const IsWin = !IsMac && !IsLinux;
export const IsEdge = /Edg\//i.test(userAgent);
export const IsFirefox = /Firefox\//i.test(userAgent);
export const Platform = IsMac ? "mac" : "win";
export const Language = languageMatch && languageMatch.groups.lang || primaryLanguage;
export const IsDev = (await chrome.management.getSelf()).installType === "development";
export const IncognitoNameUC = IsFirefox
	? "Private"
	: IsEdge
		? "InPrivate"
		: "Incognito";
export const IncognitoNameLC = IsEdge
	? "InPrivate"
	: IncognitoNameUC.toLowerCase();
export const IncognitoPermission = IsFirefox
	? "Run in Private Windows"
	: `Allow in ${IncognitoNameLC}`;
export const Homepage = "https://fwextensions.github.io/QuicKey/";
export const MinTabDwellTime = 1250;
export const PopupURL = chrome.runtime.getURL("popup.html");
export const PopupInnerWidth = 500;
export const PopupInnerHeight = 488;
export const PopupPadding = 50;
export const ResultsListRowHeight = 45;
export const CommandIDs = {
	OpenMenuCommand: "_execute_action",
	OpenPopupCommand: "010-open-popup-window",
	FocusPopupCommand: "020-focus-search",
	PreviousTabCommand: "1-previous-tab",
	NextTabCommand: "2-next-tab",
	ToggleTabsCommand: "30-toggle-recent-tabs"
};
export const SpaceBehavior = {
	Key: "spaceBehavior",
	Select: "select",
	Space: "space",
	Both: "both"
};
export const EscBehavior = {
	Key: "escBehavior",
	Clear: "clear",
	Close: "close"
};
export const HomeEndBehavior = {
	Key: "homeEndBehavior",
	ResultsList: "resultsList",
	SearchBox: "searchBox"
};
export const HidePopupBehavior = {
	Key: "hidePopupBehavior",
	Behind: "behind",
	Tab: "tab",
	Minimize: "minimize"
};
export const MarkTabsInOtherWindows = {
	Key: "markTabsInOtherWindows"
};
export const IncludeClosedTabs = {
	Key: "includeClosedTabs"
};
export const ShowTabCount = {
	Key: "showTabCount"
};
export const UsePinyin = {
	Key: "usePinyin"
};
export const RestoreLastQuery = {
	Key: "restoreLastQuery"
};
export const ShowBookmarkPaths = {
	Key: "showBookmarkPaths"
};
export const CurrentWindowLimitRecents = {
	Key: "currentWindowLimitRecents"
};
export const CurrentWindowLimitSearch = {
	Key: "currentWindowLimitSearch"
};
export const NavigateRecentsWithPopup = {
	Key: "navigateRecentsWithPopup"
};
export const Shortcuts = {
	Key: "shortcuts",
	MRUSelect: "mruSelect",
	CloseTab: "closeTab",
	MoveTabLeft: "moveTabLeft",
	MoveTabRight: "moveTabRight",
	CopyURL: "copyURL",
	CopyTitleURL: "copyTitleURL"
};
