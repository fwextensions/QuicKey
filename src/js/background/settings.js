define([
	"./quickey-storage",
	"./get-default-settings",
	"./get-chrome-shortcuts",
	"options/key-constants",
	"options/are-shortcuts-identical",
	"./constants"
], function(
	storage,
	getDefaultSettings,
	getChromeShortcuts,
	KeyConstants,
	areShortcutsIdentical,
	{IsMac, Platform}
) {
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
				const popupShortcut = chromeShortcuts.filter(
					({id}) => id == "_execute_browser_action")[0].shortcut || "";
				const popupKeys = popupShortcut.split("+");
					// filter out shift from the modifiers, since we'll use
					// shift+<mruKey> to navigate up the list
				const popupModifiers = popupKeys.slice(0, -1).filter(
					key => key.toLowerCase() != "shift");

				if (!popupModifiers.length) {
						// for some reason, Chrome sometimes doesn't return the
						// shortcut for the browser action, even if it's getting
						// triggered by it.  or the non-ASCII modifier symbols
						// on Mac might have gotten corrupted, so they don't
						// match what Chrome returns, and therefore we think
						// there's no shortcut defined.  so default to a platform-
						// specific modifier so the user can still use alt-W to
						// navigate the MRU list.
					popupModifiers[0] = DefaultPopupModifier;
				}

				settings.chrome = {
					popup: {
						key: popupKeys.pop(),
						modifiers: popupModifiers,
						modifierEventName: KeyConstants.ModifierEventNames[popupModifiers[0]]
					},
					shortcuts: chromeShortcuts
				};

				return settings;
			});
	}


	return {
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
					modifierEventName: KeyConstants.ModifierEventNames[popupModifiers[0]]
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
});
