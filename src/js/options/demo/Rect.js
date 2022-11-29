import React from "react";
import { useScaled } from "./DemoContext";

export function Rect({
	left,
	top,
	width,
	height,
	className,
	children,
	...props
})
{
	const scaled = useScaled();
	const style = {
		width: scaled(width),
		height: scaled(height),
		position: "relative",
		overflow: "hidden"
	};

	if (Number.isFinite(left)) {
		style.left = scaled(left);
		style.position = "absolute";
	}

	if (Number.isFinite(top)) {
		style.top = scaled(top);
		style.position = "absolute";
	}

	return (
		<div
			className={className}
			style={style}
			{...props}
		>
			{children}
		</div>
	);
}
