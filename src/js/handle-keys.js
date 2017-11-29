define([
	"shortcut-manager"
], function(
	ShortcutManager
) {
		// the self module global will be set in handleKeys()
	const Bindings = [
		[["ArrowUp", "alt+ArrowUp", "alt+shift+w", "ctrl+shift+w"],
			function(event) { self.modifySelected(-1, event.altKey); }],
		[["ArrowDown", "alt+ArrowDown", "alt+w", "ctrl+w"],
			function(event) { self.modifySelected(1, event.altKey); }],
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
		["mod+w",
			function() { self.closeTab(selectedTab()); }],
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
		event)
	{
		self = this;

			// we only need to check for shortcuts if there's a modifier key
			// pressed or event.key is more than 1 char (ArrowUp, etc.)
		if (event.key.length > 1 || event.altKey || event.ctrlKey || event.metaKey ||
				event.shiftKey || event.key == " ") {
			return manager.handleKeyEvent(event);
		}
	}
});
