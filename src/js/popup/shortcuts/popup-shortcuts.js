define([
	"./shortcut-manager",
	"background/constants"
], function(
	ShortcutManager,
	k
) {
	const Bindings = [
		["ArrowUp", () => self.modifySelected(-1)],
		["ArrowDown", () => self.modifySelected(1)],
		["PageUp", () => self.resultsList.scrollByPage("up")],
		["PageDown", () => self.resultsList.scrollByPage("down")],
		["Home", () => self.setSelectedIndex(0)],
		["End", () => self.setSelectedIndex(self.state.matchingItems.length - 1)],
		[["Enter", "shift+Enter"], event => openItem(event, false)],
		[["mod+Enter", "mod+shift+Enter"], event => openItem(event, true)],
		["Escape", event => self.clearQuery(event.target.value)],
		[["Space", "shift+Space"],
			event => {
				if (self.mode != "command" && self.settings[k.SpaceBehavior.Key] !== k.SpaceBehavior.Space) {
					self.modifySelected(event.shiftKey ? -1 : 1);
				} else {
						// in command mode, return true so that the space after
						// the /h or b isn't swallowed
					return true;
				}
			}]
	];
	const Manager = new ShortcutManager(Bindings);
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


	function mruSelectUp()
	{
		self.modifySelected(-1, true);
	}


	function mruSelectDown()
	{
		self.modifySelected(1, true);
	}


	function joinKeys(
		modifiers,
		baseKey)
	{
		return [].concat(modifiers).concat(baseKey).join("+");
	}


	return {
		update: function(
			settings)
		{
			const shortcuts = settings.shortcuts;
			const mruSelectKey = shortcuts[k.Shortcuts.MRUSelect];
			const popupModifiers = settings.chrome.popup.modifiers;

			Object.keys(shortcuts).forEach(function(id) {
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
				// plus the modifiers used to open the popup
			Manager.bind([
				joinKeys(popupModifiers, "ArrowDown"),
				joinKeys(popupModifiers, mruSelectKey)
			], mruSelectDown);
			Manager.bind([
				joinKeys(popupModifiers, "ArrowUp"),
				joinKeys(popupModifiers.concat("shift"), mruSelectKey)
			], mruSelectUp);
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
});
