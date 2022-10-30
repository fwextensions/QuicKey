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

		return <div className="shortcut" {...props}>
			{keyStrings.map(key => key && <Key code={key} />)}
		</div>
	};

