define([
	"bluebird",
	"./quickey-storage",
	"./get-default-settings",
	"./get-chrome-shortcuts",
	"options/key-constants",
	"options/are-shortcuts-identical"
], function(
	Promise,
	storage,
	getDefaultSettings,
	getChromeShortcuts,
	KeyConstants,
	areShortcutsIdentical
) {
	const Platform = /Mac/i.test(navigator.platform) ? "mac" : "win";


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
			.then(function(chromeShortcuts) {
				const popupShortcut = chromeShortcuts.filter(function(shortcut) {
					return shortcut.id == "_execute_browser_action";
				})[0].shortcut || "";
				const popupKeys = popupShortcut.split("+");
					// filter out shift from the modifiers, since we'll use
					// shift+<mruKey> to navigate up the list
				const popupModifiers = popupKeys.slice(0, -1).filter(function(key) {
					return key.toLowerCase() != "shift";
				});

				chromeShortcuts.popupKey = popupKeys.pop();
				chromeShortcuts.popupModifiers = popupModifiers;
				chromeShortcuts.popupModifierEventName = KeyConstants.ModifierEventNames[popupModifiers[0]];
				settings.chromeShortcuts = chromeShortcuts;

				return settings;
			});
	}


	return {
		get: function()
		{
			return storage.get()
				.then(addChromeShortcuts);
		},


		getDefaults: function()
		{
			const settings = extractSettings({ settings: getDefaultSettings() });

			settings.chromeShortcuts = [];
			settings.chromeShortcuts.popupKey = "";
			settings.chromeShortcuts.popupModifiers = [];

			return settings;
		},


		set: function(
			key,
			value)
		{
			return storage.set(function(data) {
				const settings = data.settings;
				const shortcuts = settings.shortcuts[Platform];

				if (key in settings) {
					settings[key] = value;
				} else {
					shortcuts[key] = value;

					Object.keys(shortcuts).forEach(function(shortcutID) {
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

				return { settings: settings };
			})
				.then(addChromeShortcuts);
		},


		resetShortcuts: function()
		{
			return storage.set(function(data) {
				const settings = data.settings;

					// we need to get a fresh copy of the shortcuts object,
					// instead of getting it once at the top of the module,
					// since resetting it would point settings at that copy.
					// then further changes would mutate the "defaults" object,
					// so resetting again during that session wouldn't work.
				settings.shortcuts[Platform] = getDefaultSettings().shortcuts[Platform];

				return { settings: settings };
			})
				.then(addChromeShortcuts);
		}
	};
});
