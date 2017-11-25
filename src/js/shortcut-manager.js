define(function() {
	const ShiftedKeyAliases = {
			106: '*',
			107: '+',
			109: '-',
			110: '.',
			111 : '/',
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
		},
		Modifiers = {
			alt: 1,
			ctrl: 1,
			shift: 1,
			meta: 1
		},
		Aliases = {
			option: "alt",
			opt: "alt",
			command: "meta",
			cmd: "meta",
			mod: /Mac/i.test(navigator.platform) ? "meta" : "ctrl",
			space: " "
		};


	function ShortcutManager(
		bindings)
	{
		this.bindings = {};

		if (bindings instanceof Array) {
			bindings.forEach(function(binding) {
				if (binding) {
					this.bind(binding[0], binding[1]);
				}
			}, this);
		}
	}


	Object.assign(ShortcutManager.prototype, {
		bind: function(
			shortcuts,
			callback)
		{
				// convert shortcuts to an array if necessary
			[].concat(shortcuts).forEach(function(shortcut) {
				var info = this.extractShortcutInfo(shortcut);

				(this.bindings[info.key] || (this.bindings[info.key] = [])).push({
					key: info.key,
					modifierString: info.modifiers.join("+"),
					callback: callback
				});
			}, this);
		},


		handleKeyEvent: function(
			event)
		{
				// map a shifted key to its unshifted char if necessary, and
				// switch to lowercase for matching
			var key = (ShiftedKeyAliases[event.which] || event.key).toLowerCase(),
				modifierString = this.getEventModifiers(event),
				possibleMatches = this.bindings[key] || [],
				handledKey = false;

			possibleMatches.forEach(function(binding) {
				if (!handledKey && binding.modifierString == modifierString) {
						// the callback can return true to not do the standard
						// handling, which is to call preventDefault()
					if (!binding.callback(event)) {
						event.preventDefault();
					}

					handledKey = true;
				}
			});

			return handledKey;
		},


		getEventModifiers: function(
			event)
		{
			var modifiers = [];

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
			var info = {
					modifiers: []
				},
				keys = shortcut.split("+");

			keys = keys.map(function(key) {
					// lowercase all the key names so we'll match even if a
					// modifier was written as Ctrl, and we want regular keys
					// lowercase anyway to handle shift shortcuts and capslock
				key = key.toLowerCase();
				key = Aliases[key] || key;

				if (Modifiers[key]) {
					info.modifiers.push(key);
				}

				return key;
			});

				// the main key should be last
			info.key = keys.pop();

				// sort the modifiers so we don't have to do it every time we
				// handle a key event
			info.modifiers = info.modifiers.sort();

			return info;
		},
	});


	return ShortcutManager;
});
