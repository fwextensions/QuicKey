import storage from "./quickey-storage";
import getDefaultSettings from "./get-default-settings";
import getChromeShortcuts from "./get-chrome-shortcuts";
import {ModifierEventNames} from "@/options/key-constants";
import {areShortcutsIdentical, getKeysFromShortcut} from "@/options/shortcut-utils";
import {IsMac, Platform} from "./constants";


const DefaultPopupModifier = IsMac ? "ctrl" : "alt";


function extractSettings(
	data)
{
	const settings = Object.assign({}, data.settings);

		// hide the platform distinction
	settings.shortcuts = settings.shortcuts[Platform];

	return settings;
}


function addChromeShortcuts(
	data)
{
	const settings = extractSettings(data);

	return getChromeShortcuts()
		.then(chromeShortcuts => {
			const shortcutsByID = chromeShortcuts.reduce((result, info) => ({
					...result,
					[info.id]: info
				}), {});
			const menuShortcut = chromeShortcuts.find(({id}) => id == "_execute_action").shortcut || "";
			const {baseKey, modifiers} = getKeysFromShortcut(menuShortcut);

			settings.chrome = {
				popup: {
					key: baseKey,
					modifiers,
						// for some reason, Chrome sometimes doesn't return the
						// shortcut for the browser action, even if it's getting
						// triggered by it.  or the non-ASCII modifier symbols
						// on Mac might have gotten corrupted, so they don't
						// match what Chrome returns, and therefore we think
						// there's no shortcut defined.  so default to a platform-
						// specific modifier so the user can still use alt-W to
						// navigate the MRU list.
					modifierEventName: ModifierEventNames[modifiers[0] || DefaultPopupModifier]
				},
				shortcuts: chromeShortcuts,
				shortcutsByID
			};

			return settings;
		});
}


export default {
	get: function(
		data)
	{
		if (data && typeof data == "object") {
				// the caller already got the storage data, so just use it
			return addChromeShortcuts(data);
		}

		return storage.get()
			.then(addChromeShortcuts);
	},


	getDefaults: function()
	{
		const settings = extractSettings({ settings: getDefaultSettings() });
		const popupModifiers = [DefaultPopupModifier];

		settings.chrome = {
			popup: {
				key: "",
				modifiers: popupModifiers,
				modifierEventName: ModifierEventNames[popupModifiers[0]]
			},
			shortcuts: []
		};

		return settings;
	},


	set: function(
		key,
		value)
	{
		return storage.set(({settings}) => {
			if (key in settings) {
				settings[key] = value;
			} else {
				const shortcuts = settings.shortcuts[Platform];

				shortcuts[key] = value;

				Object.keys(shortcuts).forEach(shortcutID => {
						// clear any existing identical shortcuts.  we have
						// to use a function for comparison, because some of
						// the default shortcuts are defined like mod+C,
						// which wouldn't match anything the user actually
						// pressed.
					if (shortcutID !== key && areShortcutsIdentical(shortcuts[shortcutID], value)) {
						shortcuts[shortcutID] = "";
					}
				});
			}

			return { settings };
		})
			.then(addChromeShortcuts);
	},


	resetShortcuts: function()
	{
		return storage.set(({settings}) => {
				// we need to get a fresh copy of the shortcuts object,
				// instead of getting it once at the top of the module,
				// since resetting it would point settings at that copy.
				// then further changes would mutate the "defaults" object,
				// so resetting again during that session wouldn't work.
			settings.shortcuts[Platform] = getDefaultSettings().shortcuts[Platform];

			return { settings };
		})
			.then(addChromeShortcuts);
	}
};
