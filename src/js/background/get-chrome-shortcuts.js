define([
	"cp"
], function(
	cp
) {
	const KeyAliases = {
		"Left Arrow": "ArrowLeft",
		"Right Arrow": "ArrowRight",
		"Up Arrow": "ArrowUp",
		"Down Arrow": "ArrowDown",
		"Page Up": "PageUp",
		"Page Down": "PageDown",
		"Ins": "Insert",
		"Del": "Delete",
		"Comma": ",",
		"Period": ".",
		"←": "ArrowLeft",
		"→": "ArrowRight",
		"↑": "ArrowUp",
		"↓": "ArrowDown",
		"⌃": "Ctrl",
		"⇧": "Shift",
		"⌥": "Opt",
		"⌘": "Cmd",
	};
	const ShortcutSeparator = "+";
	const MacShortcutPattern = /([⌃⇧⌥⌘]+)(.+)/;


	return function getShortcuts()
	{
		return cp.commands.getAll()
			.then(commands => commands.map(chromeShortcut => {
				const shortcutText = (chromeShortcut.shortcut || "");
				let shortcutKeys;

				if (!shortcutText.includes(ShortcutSeparator)) {
						// annoyingly, Mac Chrome returns keyboard shortcuts
						// using chars like ⇧⌘A instead of Shift+Cmd+A.  so
						// separate out the primary key name and then split the
						// modifier keys into 1-char strings.  they'll get
						// converted via the KeyAliases lookup below.
					const match = shortcutText.match(MacShortcutPattern);

					if (match && match.length == 3) {
						shortcutKeys = match[1].split("").concat(match[2]);
					} else {
						shortcutKeys = [""];
					}
				} else {
					shortcutKeys = shortcutText.split(ShortcutSeparator);
				}

					// make the modifier strings lowercase, remove spaces from
					// keys like "Page Up", and fix keys like "Right Arrow", to
					// make the order conform to the code string in the key event
				const shortcut = shortcutKeys
					.map(key => KeyAliases[key] || key)
					.join(ShortcutSeparator)
					.toLowerCase();

				return {
						// the shortcut for opening the menu doesn't have a
						// description in the manifest
					label: chromeShortcut.description || "Open the QuicKey menu",
					id: chromeShortcut.name,
					shortcut
				};
			})
		)
	}
});
