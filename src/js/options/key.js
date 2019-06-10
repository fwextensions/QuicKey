define([
	"react"
], function(
	React
) {
	const IsMac = /Mac/i.test(navigator.platform);
		// use the modifier characters as single-width keys on Mac, but use the
		// full names elsewhere
	const KeyClasses = {
		width1: [
			["ArrowLeft", "◀"],
			["ArrowRight", "▶"],
			["ArrowUp", "▲"],
			["ArrowDown", "▼"]
		].concat(!IsMac ? [] : [
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
		]
	};
	const KeyConfigs = {};


		// set up the mapping between key codes and the classes and labels to
		// use when rendering them
	Object.keys(KeyClasses).forEach(function(className) {
		KeyClasses[className].forEach(function(keyName) {
			const config = {
				label: keyName,
				className: className
			};
			var code = keyName;

			if (keyName instanceof Array) {
				config.label = keyName[1];
				code = keyName[0].toLowerCase();
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
		var label = props.label || config && config.label || code;

		if (label.length == 1) {
			label = label.toUpperCase();
		}

		return <kbd className={className}><span>{label}</span></kbd>;
	}


	return Key;
});
