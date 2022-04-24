define([
	"./key-constants"
], function(
	{ModifierAliases, ShortcutSeparator}
) {
	function getKeysFromShortcut(
		shortcut)
	{
		const keys = String(shortcut).split(ShortcutSeparator).map(key => {
			const lcKey = key.toLowerCase();

			return ModifierAliases[lcKey] || lcKey;
		});
		const modifiers = keys.slice(0, -1);
		const baseKey = keys.slice(-1);

		return {
			keys,
			modifiers: modifiers.sort(),
			baseKey: baseKey.pop()
		};
	}


	function areShortcutsIdentical(
		a,
		b)
	{
		const keysA = getKeysFromShortcut(a);
		const keysB = getKeysFromShortcut(b);

		return keysA.modifiers.join("") == keysB.modifiers.join("") &&
			keysA.baseKey == keysB.baseKey;
	}


	return {
		getKeysFromShortcut,
		areShortcutsIdentical
	};
});