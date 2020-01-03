define([
	"./key-constants"
], function(
	{ModifierAliases, ShortcutSeparator}
) {
	function getKeys(
		shortcut)
	{
		const keys = String(shortcut).split(ShortcutSeparator).map(function(key) {
			const lcKey = key.toLowerCase();

			return ModifierAliases[lcKey] || lcKey;
		});
		const modifiers = keys.slice(0, -1);
		const baseKey = keys.slice(-1);

		return {
			modifiers: modifiers.sort(),
			baseKey: baseKey.pop()
		};
	}


	return function areShortcutsIdentical(
		a,
		b)
	{
		const keysA = getKeys(a);
		const keysB = getKeys(b);

		return keysA.modifiers.join("") == keysB.modifiers.join("") &&
			keysA.baseKey == keysB.baseKey;
	};
});
