import React from "react";
import { styled } from "goober";
import { DemoContext } from "./DemoContext";
import { Rect } from "./Rect";

const Screen = styled(Rect)`
	background: white;
	border: 1px solid #eee;
	transition: border-color .25s ease-out;
	box-shadow: inset 0 -${({ taskbarHeight }) => taskbarHeight}px 0 0 #ddd;
	
	&:hover {
		border-color: #ccc;
	}
`;

export function DemoRoot({
	width,
	height,
	children })
{
	const { width: screenW, height: screenH, availHeight } = window.screen;
	let scale = .1;

	if (Number.isFinite(width)) {
		scale = width / screenW;
	} else if (Number.isFinite(height)) {
		scale = height / screenH;
	}

	return (
		<DemoContext.Provider value={{ scale }}>
			<Screen
				width={screenW}
				height={screenH}
				taskbarHeight={(screenH - availHeight) * scale}
			>
				{children}
			</Screen>
		</DemoContext.Provider>
	);
}
