define([
	"react"
], function(
	React
) {
	const IsMac = /Mac/i.test(navigator.platform);
	const WindowsArrows = [
		["ArrowLeft", "◀"],
		["ArrowRight", "▶"],
		["ArrowUp", "▲"],
		["ArrowDown", "▼"]
	];
		// these arrows look too skinny on Windows
	const MacArrows = [
		["ArrowLeft", "←"],
		["ArrowRight", "→"],
		["ArrowUp", "↑"],
		["ArrowDown", "↓"]
	];
		// use the modifier characters as single-width keys on Mac, but use the
		// full names elsewhere
	const KeyClasses = {
		width1: (IsMac ? MacArrows : WindowsArrows).concat(!IsMac ? [] : [
			["ctrl", "⌃"],
			["shift", "⇧"],
			["opt", "⌥"],
			["cmd", "⌘"]
		]),
		width2: [
			"end",
			"tab"
		].concat(IsMac ? [] : [
			"alt",
			"ctrl",
			"opt",
			"shift"
		]),
		width3: [
			"enter",
			"home",
			"insert",
			"delete",
			"space",
			[" ", "space"],
			["PageUp", "pg up"],
			["PageDown", "pg dn"]
		],
		width4: [
			"backspace"
		]
	};
	const KeyConfigs = {};


		// set up the mapping between key codes and the classes and labels to
		// use when rendering them
	Object.keys(KeyClasses).forEach(className => {
		KeyClasses[className].forEach(keyName => {
			const config = {
				label: keyName,
				className: className
			};
			let code = keyName;

			if (keyName instanceof Array) {
				code = keyName[0].toLowerCase();
				config.label = keyName[1];
			}

			KeyConfigs[code] = config;
		});
	});


	function Key(
		props)
	{
		const code = props.code;
		const config = KeyConfigs[code];
		const className = config && config.className || "width1";
		let label = props.label || (config && config.label) || code;

		if (label.length == 1) {
			label = label.toUpperCase();
		}

		return <kbd className={className}><span>{label}</span></kbd>;
	}

	return Key;
});
