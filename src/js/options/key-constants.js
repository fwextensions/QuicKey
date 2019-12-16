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
			char: 4
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
		ShortcutSeparator: "+",
		FunctionKeyPattern: /^F\d{1,2}$/i
	};
});
