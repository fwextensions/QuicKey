import ShortcutManager from "./shortcut-manager";
import * as k from "@/background/constants";


const EmptyOrSpacePattern = /^(?:\s*|.*\s)$/;


const MenuBindings = [
	[["ArrowUp", "Ctrl+P", "Ctrl+K"], () => self.modifySelected(-1)],
	[["ArrowDown", "Ctrl+N", "Ctrl+J"], () => self.modifySelected(1)],
	["PageUp", () => self.resultsList.scrollByPage("up")],
	["PageDown", () => self.resultsList.scrollByPage("down")],
	[["Enter", "shift+Enter"], event => openItem(event, false)],
	[["mod+Enter", "mod+shift+Enter"], event => openItem(event, true)],
		// stop ctrl/cmd-F from closing the popup and opening the find menu
	["mod+F", () => {}],
	["Escape", event => self.clearQuery(event.target.value)],
	[["Home", "End"], event => {
		if (self.settings[k.HomeEndBehavior.Key] == k.HomeEndBehavior.ResultsList) {
			if (event.key == "Home") {
				self.setSelectedIndex(0)
			} else {
				self.setSelectedIndex(self.state.matchingItems.length - 1);
			}
		} else {
				// return true to let the input field handle the keys
			return true;
		}
	}],
	[["ctrl+Space", "ctrl+shift+Space"], event => self.modifySelected(event.shiftKey ? -1 : 1)],
	[["Space", "shift+Space"], event => {
		const setting = self.settings[k.SpaceBehavior.Key];
			// when the mode is command, `query` will be empty, even though `/b`
			// has been typed in the search box.  if there's selected text in
			// the search box, don't replace the text with a space and just move
			// the selection instead.
		const allowSpace = !self.searchBox.getSelection()
			&& (setting !== k.SpaceBehavior.Select)
			&& (self.mode === "command"
				|| (!event.shiftKey && !EmptyOrSpacePattern.test(self.state.query)));
		const currentSelection = self.state.selected;

		if (setting !== k.SpaceBehavior.Space) {
				// only the Space option prevents selection, so select the next
				// item either after inserting a space or immediately
			if (allowSpace) {
					// we are going to allow the space to be inserted, which will
					// change the searchBoxText, which will in turn reset the selection
					// to the 0th item.  since we don't currently have a clean way to
					// execute this after that state change has been made, change the
					// selection in a timeout.  FIXME
				setTimeout(() => self.setSelectedIndex(currentSelection + 1), 25);
			} else {
				self.modifySelected(event.shiftKey ? -1 : 1);
			}
		}

		return allowSpace;
	}]
];
const Manager = new ShortcutManager();
const Handlers = {
	[k.Shortcuts.CloseTab]: () => self.closeTab(selectedTab()),
	[k.Shortcuts.MoveTabLeft]: event => moveTab(-1, event.shiftKey),
	[k.Shortcuts.MoveTabRight]: event => moveTab(1, event.shiftKey),
	[k.Shortcuts.CopyURL]: () => self.copyItemURL(selectedTab(), false),
	[k.Shortcuts.CopyTitleURL]: () => self.copyItemURL(selectedTab(), true)
};
const ShiftShortcuts = {
	[k.Shortcuts.MoveTabLeft]: 1,
	[k.Shortcuts.MoveTabRight]: 1
};
const {
	OpenPopupCommand,
	FocusPopupCommand,
	PreviousTabCommand,
	NextTabCommand
} = k.CommandIDs;


	// the self module global will be set in handleEvent()
let self;


function selectedTab()
{
	return self.state.matchingItems[self.state.selected];
}


function openItem(
	event,
	modKey)
{
	self.openItem(selectedTab(), event.shiftKey, modKey);
}


function moveTab(
	direction,
	shiftKey)
{
	if (self.mode == "tabs") {
		self.moveTab(selectedTab(), direction, shiftKey);
	}
}


function joinKeys(
	modifiers,
	baseKey)
{
	return [].concat(modifiers).concat(baseKey).join("+");
}


function findShortcut(
	shortcuts,
	shortcutID)
{
	const {shortcut = ""} = shortcuts.find(({id}) => id == shortcutID) || {};

	return shortcut;
}


function createShiftedShortcut(
	shortcuts,
	shortcutID)
{
	const keys = findShortcut(shortcuts, shortcutID).split("+");
	const modifier = keys[0];
	const baseKey = keys.pop();

	return baseKey && joinKeys([modifier, "shift"], baseKey);
}


export default {
	update: function(
		settings)
	{
		const {
			shortcuts,
			chrome: {
// TODO: get rid of popup special case here and use shortcutsByID instead
				popup: {modifiers: popupModifiers},
				shortcuts: chromeShortcuts}
		} = settings;
		const mruSelectKey = shortcuts[k.Shortcuts.MRUSelect];
		const selectDownShortcuts = [
			joinKeys(popupModifiers, "ArrowDown"),
			joinKeys(popupModifiers, mruSelectKey),
			findShortcut(chromeShortcuts, PreviousTabCommand),
			findShortcut(chromeShortcuts, OpenPopupCommand),
			findShortcut(chromeShortcuts, FocusPopupCommand)
		];
		const selectUpShortcuts = [
			joinKeys(popupModifiers, "ArrowUp"),
			joinKeys(popupModifiers.concat("shift"), mruSelectKey),
			findShortcut(chromeShortcuts, NextTabCommand),
			createShiftedShortcut(chromeShortcuts, OpenPopupCommand),
			createShiftedShortcut(chromeShortcuts, FocusPopupCommand)
		];

			// first reset all the bindings, in case we're getting called
			// with updated settings, then bind the non-customizable keys
		Manager.unbindAll();
		Manager.bindAll(MenuBindings);

			// bind the customizable shortcuts
		Object.keys(shortcuts).forEach(id => {
			const handler = Handlers[id];
			const shortcut = [shortcuts[id]];

			if (handler) {
					// some customizable shortcuts use shift to unsuspend
					// the tab when performing the action
				if (id in ShiftShortcuts) {
					shortcut.push("shift+" + shortcut[0]);
				}

				Manager.bind(shortcut, handler);
			}
		});

			// add handlers for navigating up and down with the MRU key,
			// plus the modifiers used to open the popup.  pass true to let
			// the app know the MRU key was used, so that when the modifier
			// up event happens, the selected tab will be switched to
			// (unlike the plain up/down arrow keys bound above).
		Manager.bind(selectDownShortcuts, () => self.modifySelected(1, true));
		Manager.bind(selectUpShortcuts, () => self.modifySelected(-1, true));
	},


	handleEvent: function(
		event,
		context)
	{
		self = context;

			// we only need to check for shortcuts if there's a modifier key
			// pressed or event.key is more than 1 char (ArrowUp, etc.)
		if (event.key.length > 1 || event.altKey || event.ctrlKey || event.metaKey ||
				event.shiftKey || event.key == " ") {
			return Manager.handleKeyEvent(event);
		}
	}
};
