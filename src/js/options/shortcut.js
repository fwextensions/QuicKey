import React from "react";
import Key from "./key";
import {getKeysFromShortcut} from "./shortcut-utils";


export default function Shortcut({
	keys,
	...props})
{
	const keyStrings = Array.isArray(keys)
		? keys
		: getKeysFromShortcut(keys).keys;

		// key key key...
	return <span className="shortcut" {...props}>
		{keyStrings.map(key => key && <Key key={key} code={key} />)}
	</span>
};
