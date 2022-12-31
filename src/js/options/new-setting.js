import React, { useContext } from "react";
import { OptionsContext } from "@/options/options-provider";


export default function NewSetting({
	addedVersion,
	children })
{
	const {lastSeenOptionsVersion} = useContext(OptionsContext);

	return (
		<div className="new-setting">
			{lastSeenOptionsVersion < addedVersion &&
				<div className="new-indicator">NEW</div>
			}
			{children}
		</div>
	);
}
