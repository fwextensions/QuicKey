define([
	"./shortcut-manager"
], function(
	ShortcutManager
) {
		// the self module global will be set in handleKeys()
	const Bindings = [
			["ArrowUp",
				function() { self.modifySelected(-1); }],
			["ArrowDown",
				function() { self.modifySelected(1); }],
			[["win:alt+ArrowUp", "win:alt+shift+w", "mac:ctrl+shift+w", "mac:ctrl+ArrowUp"],
				function() { self.modifySelected(-1, true); }],
			[["win:alt+ArrowDown", "win:alt+w", "mac:ctrl+w", "mac:ctrl+ArrowDown"],
				function() { self.modifySelected(1, true); }],
			["PageUp",
				function() { self.resultsList.scrollByPage("up"); }],
			["PageDown",
				function() { self.resultsList.scrollByPage("down"); }],
			["Home",
				function() { self.setSelectedIndex(0); }],
			["End",
				function() { self.setSelectedIndex(self.state.matchingItems.length - 1); }],
			[["Enter", "shift+Enter"],
				function(event) { openItem(event, false); }],
			[["mod+Enter", "mod+shift+Enter"],
				function(event) { openItem(event, true); }],
			[["ctrl+[", "ctrl+shift+["],
				function(event) { moveTab(-1, event.shiftKey); }],
			[["ctrl+]", "ctrl+shift+]"],
				function(event) { moveTab(1, event.shiftKey); }],
			[["win:ctrl+w", "mac:cmd+ctrl+w"],
				function() { self.closeTab(selectedTab()); }],
			[["win:ctrl+c", "win:ctrl+shift+c", "mac:cmd+c", "mac:cmd+shift+c"],
				function(event) { self.copyItemURL(selectedTab(), event.shiftKey); }],
			["Escape",
				function(event) { self.clearQuery(event.target.value); }],
			[["Space", "shift+Space"],
				function(event) {
					if (self.mode != "command") {
						self.modifySelected(event.shiftKey ? -1 : 1);
					} else {
							// in command mode, return true so that the space after
							// the /h or b isn't swallowed
						return true;
					}
				}]
		];


	var self,
		manager = new ShortcutManager(Bindings);


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


	return function handleKeys(
		event,
		context)
	{
		self = context || this;

			// we only need to check for shortcuts if there's a modifier key
			// pressed or event.key is more than 1 char (ArrowUp, etc.)
		if (event.key.length > 1 || event.altKey || event.ctrlKey || event.metaKey ||
				event.shiftKey || event.key == " ") {
			return manager.handleKeyEvent(event);
		}
	}
});
