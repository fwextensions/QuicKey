import React from "react";
import {AlertIcon, ClearIcon} from "@/common/icons";


	// a note above the results list.  the app decides when to show it and
	// what it says; this just draws it.
export default function Banner(
	props)
{
	return <div className="banner">
		<AlertIcon />
		<div className="banner-text">
			{props.message}
		</div>
		<button className="close-button"
			title="Dismiss"
			onClick={props.onClose}
				// prevent the click from stealing focus from the search box
			onMouseDown={event => event.preventDefault()}
		>
			<ClearIcon />
		</button>
	</div>
}
