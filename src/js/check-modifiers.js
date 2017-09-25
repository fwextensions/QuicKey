define(function() {
	const Aliases = {
			option: "alt",
			opt: "alt",
			command: "meta",
			cmd: "meta",
			mod: /Win/i.test(navigator.platform) ? "ctrl" : "meta"
		};


	function getEventModifiers(
		event)
	{
		var modifiers = [];

		event.altKey && modifiers.push("alt");
		event.ctrlKey && modifiers.push("ctrl");
		event.metaKey && modifiers.push("meta");
		event.shiftKey && modifiers.push("shift");

		return modifiers;
	}


	return function checkModifiers(
		event,
		modifiers)
	{
		var modifierArray = modifiers.split("+").map(function(key) {
				return Aliases[key] || key;
			}),
			eventModifiers = getEventModifiers(event);

		return modifierArray.join("") == eventModifiers.join("");
	}
});
