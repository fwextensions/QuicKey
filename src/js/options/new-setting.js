import React, { useContext } from "react";
import { OptionsContext } from "@/options/options-provider";
import { Group, RadioGroup } from "@/options/controls";


function containsGroup(
	children)
{
	const childrenArray = React.Children.toArray(children);

	return childrenArray.filter(({ type }) => type === Group || type === RadioGroup).length > 0;
}


export default function NewSetting({
	addedVersion,
	children })
{
	const {lastSeenOptionsVersion} = useContext(OptionsContext);
	const className="new-setting" + (containsGroup(children)
		? " control-group"
		: "");

	return (
		<div className={className}>
			{lastSeenOptionsVersion < addedVersion &&
				<div className="new-indicator">NEW</div>
			}
			{children}
		</div>
	);
}
