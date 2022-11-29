import React, { useState } from "react";
import { calcPosition } from "@/background/popup-utils";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import { Window } from "./Window";

function shuffle(
	array)
{
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}

	return array;
}

export default function NavigateRecents({
	width = 250,
	height,
	tabCount = 8})
{
	const [recents] = useState(shuffle(Array.from(Array(tabCount).keys())));
	const [activeTab, setActiveTab] = useState(0);
	const { left, top, width: popupW, height: popupH } = calcPosition(null, { alignment: "right-center" });

	return (
		<DemoRoot
			width={width}
			height={height}
		>
			<Browser
				tabCount={tabCount}
				activeTab={recents[activeTab]}
				onClick={() => setActiveTab((activeTab + 1) % 8)}
			/>
			<Window
				width={popupW}
				height={popupH}
				left={left}
				top={top}
			/>
		</DemoRoot>
	);
}
