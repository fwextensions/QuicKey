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
	position: relative;
	box-sizing: content-box;
	
	&:hover {
		border-color: var(--border-color-hover, #ccc);
	}
`;
const Taskbar = styled(Rect)`
	width: 100%;
	background: var(--taskbar, #ddd);
	bottom: 0;
	position: absolute;
	z-index: 75;
	
	.mac & {
		width: 60%;
		left: 20%;
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
			>
				<Taskbar height={screenH - availHeight} />
				{children}
			</Screen>
		</DemoContext.Provider>
	);
}
