import React from "react";


export default function MessageItem(
	props)
{
	const item = props.item;

	return <div className="results-list-item message"
		style={props.style}
		title={item.tooltip}
	>
		<div className="title"
			style={{ backgroundImage: "url(" + item.faviconURL + ")" }}
		>
			{item.message}
		</div>
	</div>
}
