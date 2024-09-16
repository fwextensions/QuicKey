// add a comment that'll be preserved through the build so we can see if these
// characters still get mangled in Chrome store versions
/* @preserve ⌃⇧⌥⌘ */

import { getKeysFromShortcut } from "@/options/shortcut-utils";
import { ModifierEventNames } from "@/options/key-constants";


const fromCodePoints = (entries) => entries
	.map(([codePoint, alias]) => [String.fromCodePoint(codePoint), alias]);

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
	"Media Previous Track": "MediaTrackPrevious",
	"Media Next Track": "MediaTrackNext",
	"Media Play/Pause": "MediaPlayPause",
	"Media Stop": "MediaStop",
		// Unicode chars used as keys show up as broken chars in Chrome
		// after r.js and babel combine the files.  so build the lookup table
		// at runtime from the code point values, to avoid depending on a
		// string like "\u2190", which also gets mangled.
	...Object.fromEntries(fromCodePoints([
		[0x2190, "ArrowLeft"],  // ←
		[0x2192, "ArrowRight"], // →
		[0x2191, "ArrowUp"],    // ↑
		[0x2193, "ArrowDown"],  // ↓
		[0x2303, "Ctrl"],       // ⌃
		[0x21E7, "Shift"],      // ⇧
		[0x2325, "Opt"],        // ⌥
		[0x2318, "Cmd"]         // ⌘
	]))
};
const ShortcutSeparator = "+";
const ShortcutSeparatorPattern = /\s*\+\s*/;
const MacShortcutPattern = /([\u2303\u21E7\u2325\u2318]+)(.+)/;
	// Unicode chars in a regex also show up broken
//	const MacShortcutPattern = /([⌃⇧⌥⌘]+)(.+)/;

export default function getShortcuts()
{
	return chrome.commands.getAll()
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
			const info = getKeysFromShortcut(shortcut);
			const modifierEventName = ModifierEventNames[info.modifiers[0]];

			return {
					// the shortcut for opening the menu doesn't have a
					// description in the manifest
				label: chromeShortcut.description || "Open the QuicKey menu",
				id: chromeShortcut.name,
				shortcut,
				modifierEventName,
				...info
			};
		})
	)
}
