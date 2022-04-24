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
		style})
	{
		const keyStrings = Array.isArray(keys)
			? keys
			: getKeysFromShortcut(keys).keys;

		return <div className="shortcut"
			style={style}
		>
			{keyStrings.map(key => key && <Key code={key} />)}
		</div>
	};
});
