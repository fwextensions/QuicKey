define([
	"./constants"
], function(
	k
) {
	const DefaultShortcuts = {
		[k.Shortcuts.MRUSelect]: "w",
		[k.Shortcuts.CloseTab]: "ctrl+w",
		[k.Shortcuts.MoveTabLeft]: "ctrl+[",
		[k.Shortcuts.MoveTabRight]: "ctrl+]",
		[k.Shortcuts.CopyURL]: "mod+c",
		[k.Shortcuts.CopyTitleURL]: "mod+shift+c"
	};
		// we can't use cmd+W on Mac to close the tab selected in the menu
		// because the browser intercepts that and closes the current tab, so
		// append an override of cmd+ctrl+w
	const MacDefaults = Object.assign({}, DefaultShortcuts,
		{ [k.Shortcuts.CloseTab]: "cmd+ctrl+w" });
	const DefaultSettings = {
		[k.SpaceBehavior.Key]: k.SpaceBehavior.Select,
		[k.EscBehavior.Key]: k.EscBehavior.Clear,
		[k.MarkTabsInOtherWindows.Key]: true,
		[k.IncludeClosedTabs.Key]: true,
		[k.Shortcuts.Key]: {
			mac: MacDefaults,
			win: DefaultShortcuts
		}
	};


	return function getDefaultSettings()
	{
		return JSON.parse(JSON.stringify(DefaultSettings));
	};
});
