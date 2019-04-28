define(function() {
	const IsMac = /Mac/i.test(navigator.platform);

	return {
		KeyOrder: {
			ctrl: 0,
			control: 0,
			mod: IsMac ? 3 : 0,
			alt: 1,
			opt: 1,
				// ignore the Windows key on Windows
			meta: IsMac ? 1 : -1,
			shift: 2,
			cmd: 3,
			char: 4,
				// enter and tab are special-cased to show them in the disabled
				// Chrome shortcut pickers
			enter: 5,
			tab: 5
		},
		ModifierAliases: {
			alt: IsMac ? "opt" : "alt",
			mod: IsMac ? "cmd" : "ctrl",
			control: "ctrl",
				// ignore the Windows key on Windows
			meta: IsMac ? "cmd" : ""
		},
		ModifierEventNames: {
			alt: "Alt",
			opt: "Alt",
			ctrl: "Control",
			cmd: "Meta"
		},
		ShortcutSeparator: "+"
	};
});
