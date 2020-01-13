define([
	"shared"
], function(
	shared
) {
	const IsMac = /Mac/i.test(navigator.platform);

	return shared("k", () => ({
		IsMac,
		Platform: IsMac ? "mac" : "win",
			// this will get overridden in background.js if we're in dev mode
		IsDev: false,
		IsEdge: /Edg\//i.test(navigator.userAgent),
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
		MarkTabsInOtherWindows: {
			Key: "markTabsInOtherWindows"
		},
		IncludeClosedTabs: {
			Key: "includeClosedTabs"
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
