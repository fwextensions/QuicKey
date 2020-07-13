define(function() {
	const IsMac = /Mac/i.test(navigator.platform);
	const Platforms = {
		mac: IsMac,
		win: !IsMac
	};
	const ShiftedKeyAliases = {
		106: '*',	// numpad
		107: '+',	// numpad
		109: '-',	// numpad
		110: '.',	// numpad
		111: '/',	// numpad
		186: ';',
		187: '=',
		188: ',',
		189: '-',
		190: '.',
		191: '/',
		192: '`',
		219: '[',
		220: '\\',
		221: ']',
		222: '\''
	};
	const Modifiers = {
		alt: 1,
		ctrl: 1,
		shift: 1,
		meta: 1
	};
	const Aliases = {
		option: "alt",
		opt: "alt",
		control: "ctrl",
		command: "meta",
		cmd: "meta",
		windows: "meta",
		win: "meta",
		mod: IsMac ? "meta" : "ctrl",
		space: " "
	};
	const PlatformPattern = /^([^:]+):(.+)/;
	const UseKeyCodePattern = /^[a-z0-9]$/;
	const ModifierSeparator = /[-+ ]/;


	function ShortcutManager(
		bindings)
	{
		this.bindings = {};
		this.bindAll(bindings)
	}


	Object.assign(ShortcutManager.prototype, {
		bind: function(
			shortcuts,
			callback)
		{
				// convert shortcuts to an array if necessary
			[].concat(shortcuts).forEach(shortcut => {
				if (!shortcut) {
					return;
				}

				const info = this.extractShortcutInfo(shortcut);

					// only store the binding if no platform was specified, or
					// if it's the same as the current platform
				if (!info.platform || Platforms[info.platform]) {
					const keyIndex = info.keyCode || info.key;
					const bindings = this.bindings[keyIndex] || (this.bindings[keyIndex] = []);

						// add the binding to the front so that the most recently
						// added bindings override earlier ones
					bindings.unshift({
						key: info.key,
						modifiers: info.modifiers,
						callback
					});
				}
			});
		},


		bindAll: function(
			bindings)
		{
			if (bindings instanceof Array) {
				bindings.forEach(binding => binding && this.bind(binding[0], binding[1]));
			}
		},


		unbind: function(
			shortcuts)
		{
			[].concat(shortcuts).forEach(shortcut => {
				if (!shortcut) {
					return;
				}

				const info = this.extractShortcutInfo(shortcut);
				const keyIndex = info.keyCode || info.key;
				const keyBindings = this.bindings[keyIndex];

				if (keyBindings && keyBindings.length) {
					this.bindings[keyIndex] = keyBindings.filter(({key, modifiers}) =>
						key !== info.key && modifiers !== info.modifiers);

					if (!this.bindings[keyIndex].length) {
						delete this.bindings[keyIndex];
					}
				}
			});
		},


		unbindAll: function()
		{
			this.bindings = {};
		},


		handleKeyEvent: function(
			event)
		{
				// map a shifted key to its unshifted char if necessary, and
				// switch to lowercase for matching
			const key = ShiftedKeyAliases[event.keyCode] || event.key.toLowerCase();
			const modifiers = this.getEventModifiers(event);
			const possibleMatches = this.bindings[event.keyCode] || this.bindings[key] || [];

			for (let i = 0, len = possibleMatches.length; i < len; i++) {
				const binding = possibleMatches[i];

				if (binding.modifiers == modifiers) {
						// the callback can return true to not do the standard
						// handling, which is to call preventDefault().  use
						// strict inequality to make sure true was actually
						// returned, in case the handler happens to return a
						// promise or something.
					if (binding.callback(event) !== true) {
						event.preventDefault();
					}

					return true;
				}
			}

			return false;
		},


		getEventModifiers: function(
			event)
		{
			const modifiers = [];

				// add the modifiers in a sorted order so we don't have to call
				// sort() when joining them below
			event.altKey && modifiers.push("alt");
			event.ctrlKey && modifiers.push("ctrl");
			event.metaKey && modifiers.push("meta");
			event.shiftKey && modifiers.push("shift");

			return modifiers.join("+");
		},


		extractShortcutInfo: function(
			shortcut)
		{
			const platformMatch = shortcut.match(PlatformPattern);
			const info = {
				platform: platformMatch && platformMatch[1],
			};
			const modifiers = [];
			const shortcutString = platformMatch ? platformMatch[2] : shortcut;
			const keys = shortcutString.split(ModifierSeparator).map(key => {
					// lowercase all the key names so we'll match even if a
					// modifier was written as Ctrl, and we want regular keys
					// lowercase anyway to handle shift shortcuts and capslock
				key = key.toLowerCase();
				key = Aliases[key] || key;

				if (Modifiers[key]) {
					modifiers.push(key);
				}

				return key;
			});
			const baseKey = keys[keys.length - 1];

			info.key = baseKey;

				// we only want to look at the event's keyCode for A-Z and 0-9,
				// where the charCode is the same as the keyCode
			if (UseKeyCodePattern.test(baseKey)) {
				info.keyCode = baseKey.toUpperCase().charCodeAt(0);
			}

				// sort the modifiers so they match what's returned by
				// getEventModifiers()
			info.modifiers = modifiers.sort().join("+");

			return info;
		}
	});


	return ShortcutManager;
});
