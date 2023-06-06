// add a comment that'll be preserved through the build so we can see if these
// characters still get mangled in Chrome store versions
/* @preserve ⌃⇧⌥⌘ */

define([
	"cp"
], function(
	cp
) {
	const KeyAliases = Object.assign(
		{
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
			"Media Previous Track": "MediaTrackPrevious",
			"Media Next Track": "MediaTrackNext",
			"Media Play/Pause": "MediaPlayPause",
			"Media Stop": "MediaStop",
		},
				// Unicode chars used as keys show up as broken chars in Chrome
				// after r.js and babel combine the files
//			"←": "ArrowLeft",
//			"→": "ArrowRight",
//			"↑": "ArrowUp",
//			"↓": "ArrowDown",
//			"⌃": "Ctrl",
//			"⇧": "Shift",
//			"⌥": "Opt",
//			"⌘": "Cmd",
		Object.fromEntries([
			[0x2190, "ArrowLeft"],
			[0x2192, "ArrowRight"],
			[0x2191, "ArrowUp"],
			[0x2193, "ArrowDown"],
			[0x2303, "Ctrl"],
			[0x21E7, "Shift"],
			[0x2325, "Opt"],
			[0x2318, "Cmd"]
		].map(([codePoint, alias]) => [String.fromCodePoint(codePoint), alias]))
	);
	const ShortcutSeparator = "+";
	const ShortcutSeparatorPattern = /\s*\+\s*/;
	const MacShortcutPattern = /([\u2303\u21E7\u2325\u2318]+)(.+)/;
		// Unicode chars in a regex also show up broken
//	const MacShortcutPattern = /([⌃⇧⌥⌘]+)(.+)/;

		// the only way to prevent babel from converting the \u strings to
		// literal chars seems to be to set the keys this way after the object's
		// been created
//	KeyAliases["\u2190"] = "ArrowLeft";
//	KeyAliases["\u2192"] = "ArrowRight";
//	KeyAliases["\u2191"] = "ArrowUp";
//	KeyAliases["\u2193"] = "ArrowDown";
//	KeyAliases["\u2303"] = "Ctrl";
//	KeyAliases["\u21E7"] = "Shift";
//	KeyAliases["\u2325"] = "Opt";
//	KeyAliases["\u2318"] = "Cmd";

	return function getShortcuts()
	{
		return cp.commands.getAll()
			.then(commands => commands.map(chromeShortcut => {
				const shortcutText = (chromeShortcut.shortcut || "");
				let shortcutKeys;

				if (shortcutText.indexOf("Media") > -1) {
					shortcutKeys = [shortcutText];
				} else if (!shortcutText.includes(ShortcutSeparator)) {
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
					shortcutKeys = shortcutText.split(ShortcutSeparatorPattern);
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
