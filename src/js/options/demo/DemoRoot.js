import React from "react";
import { styled } from "goober";
import { DemoContext } from "./DemoContext";
import { Rect } from "./Rect";

const Screen = styled(Rect)`
	background: white;
	border: 1px solid #eee;
	margin: 2em auto 0;
`;

export function DemoRoot({
	width,
	height,
	children })
{
	const { width: screenW, height: screenH } = window.screen;
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
			>
				{children}
			</Screen>
		</DemoContext.Provider>
	);
}
