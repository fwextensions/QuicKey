define([
	"react",
	"jsx!./key",
	"./shortcut-utils"
], function(
	React,
	Key,
	{getKeysFromShortcut}
) {
	return function Shortcut({
		keys,
		...props})
	{
		const keyStrings = Array.isArray(keys)
			? keys
			: getKeysFromShortcut(keys).keys;

		return <div className="shortcut" {...props}>
			{keyStrings.map(key => key && <Key code={key} />)}
		</div>
	};
});
