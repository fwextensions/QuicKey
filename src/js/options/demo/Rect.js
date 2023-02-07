import React from "react";
import { useScaled } from "./DemoContext";
import { styled } from "goober";

function scaledValue(
	props,
	name)
{
	const scaled = useScaled();
	const value = props[name];

	if (Number.isFinite(value)) {
		return `${name}: ${scaled(value)}`;
	} else {
		return "";
	}
}

const ScaledContainer = styled.div`
	${(props) => scaledValue(props, "left")};
	${(props) => scaledValue(props, "top")};
	${(props) => scaledValue(props, "width")};
	${(props) => scaledValue(props, "height")};
	position: ${({ left, top }) => Number.isFinite(left) || Number.isFinite(top) ? "absolute" : "relative"};
	overflow: hidden;
`;

export function Rect({
	left,
	top,
	width,
	height,
	className,
	children })
{
	const bounds = { left, top, width, height };

	return (
		<ScaledContainer
			{...bounds}
			className={className}
		>
			{children}
		</ScaledContainer>
	);
}
