import React from "react";
import { styled } from "goober";

function scaledValue(
	props,
	name)
{
	const value = props[name];

	if (Number.isFinite(value)) {
		return `${name}: calc(${value} * var(--px))`;
	} else {
		return "";
	}
}

export const Rect = styled.div`
	${(props) => scaledValue(props, "left")};
	${(props) => scaledValue(props, "top")};
	${(props) => scaledValue(props, "width")};
	${(props) => scaledValue(props, "height")};
	position: ${({ left, top }) => Number.isFinite(left) || Number.isFinite(top) ? "absolute" : "relative"};
	overflow: hidden;
`;
