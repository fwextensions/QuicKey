import React, { useState } from "react";
import { styled } from "goober";
import { calcPosition } from "@/background/popup-utils";
import { DemoContext } from "@/options/demo/DemoContext";
import { Window } from "@/options/demo/Window";
import { Rect } from "@/options/demo/Rect";
import Browser from "@/options/demo/Browser";

const Screen = styled(Rect)`
	background: white;
	border: 1px solid #eee;
	margin: 2em auto 0;
`;

export function DemoRoot({
	width,
	height })
{
	const [activeTab, setActiveTab] = useState(0);
	const { width: screenW, height: screenH } = window.screen;
	const { left, top, width: popupW, height: popupH } = calcPosition(null, { alignment: "right-center" });
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
				onClick={() => setActiveTab((activeTab + 1) % 8)}
			>
				<Browser
					tabCount={8}
					activeTab={activeTab}
				/>
				<Window
					width={popupW}
					height={popupH}
					left={left}
					top={top}
				/>
			</Screen>
		</DemoContext.Provider>
	);
}
