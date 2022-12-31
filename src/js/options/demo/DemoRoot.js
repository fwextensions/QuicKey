import React from "react";
import { styled } from "goober";
import { DemoContext } from "./DemoContext";
import { Rect } from "./Rect";

const Screen = styled(Rect)`
	@media (prefers-color-scheme: dark) {
		--background: black;
		--border-color: #333;
		--border-color-hover: #666;
		--taskbar: #555;
	}

	background: var(--background, white);
	border: 1px solid var(--border-color, #eee);
	transition: border-color .25s ease-out;
	box-shadow: inset 0 -${({ taskbarHeight }) => taskbarHeight}px 0 0 var(--taskbar, #ddd);
	
	&:hover {
		border-color: var(--border-color-hover, #ccc);
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
