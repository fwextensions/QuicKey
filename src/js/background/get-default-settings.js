import * as k from "./constants";


const DefaultShortcuts = {
	[k.Shortcuts.MRUSelect]: "w",
		// on Linux, the extension menu can't seem to capture ctrl-W, like
		// macOS, so default to a different shortcut.  same with Firefox on
		// any platform.
	[k.Shortcuts.CloseTab]: (k.IsLinux || k.IsFirefox) ? "ctrl+alt+w" : "ctrl+w",
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
		// on FF, pressing esc always closes the menu and can't be prevented
	[k.EscBehavior.Key]: k.IsFirefox ? k.EscBehavior.Close : k.EscBehavior.Clear,
	[k.HomeEndBehavior.Key]: k.HomeEndBehavior.ResultsList,
	[k.HidePopupBehavior.Key]: k.HidePopupBehavior.Behind,
	[k.MarkTabsInOtherWindows.Key]: true,
	[k.IncludeClosedTabs.Key]: true,
	[k.ShowTabCount.Key]: false,
	[k.UsePinyin.Key]: false,
	[k.RestoreLastQuery.Key]: false,
	[k.ShowBookmarkPaths.Key]: true,
	[k.CurrentWindowLimitRecents.Key]: false,
	[k.CurrentWindowLimitSearch.Key]: false,
	[k.NavigateRecentsWithPopup.Key]: true,
	[k.Shortcuts.Key]: {
		mac: MacDefaults,
		win: DefaultShortcuts
	}
};


export default function getDefaultSettings()
{
	return JSON.parse(JSON.stringify(DefaultSettings));
}
