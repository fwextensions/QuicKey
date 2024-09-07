import React from "react";
import {OptionsIcon} from "@/common/icons";


export default function OptionsButton({
	newSettingsAvailable,
	onClick
}) {
	const tooltip = newSettingsAvailable
		? "New options are available"
		: "Options";

	return (
		<div className="options-button"
			title={tooltip}
			onClick={onClick}
		>
			<OptionsIcon/>
			{newSettingsAvailable && <div className="badge" />}
		</div>
	);
};
