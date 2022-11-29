import React, { useState } from "react";
import { calcPosition } from "@/background/popup-utils";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import { Window } from "./Window";

export default function NavigateRecents({
	width = 250,
	height })
{
	const [activeTab, setActiveTab] = useState(3);
	const { left, top, width: popupW, height: popupH } = calcPosition(null, { alignment: "right-center" });

	return (
		<DemoRoot
			width={width}
			height={height}
		>
			<Browser
				tabCount={8}
				activeTab={activeTab}
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
