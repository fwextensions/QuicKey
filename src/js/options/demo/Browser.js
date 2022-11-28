import React, { useEffect, useState } from "react";
import { styled } from "goober";
import cp from "cp";
import { rndGradient } from "./utils";
import { Window } from "./Window";

const BrowserWindow = styled(Window)`
	background: ${rndGradient()};
`;
const TabBar = styled.div`
	width: 100%;
	height: 5px;
	border-bottom: 4px solid white;
	background: #e8eaed;
	box-sizing: content-box;
`;

export default function Browser({
	tabCount = 5,
	activeTab = 3 })
{
	const [browserWindow, setBrowserWindow] = useState(null);

	useEffect(() => {
		(async () => {
			const win = await cp.windows.getCurrent();

			setBrowserWindow(win);
		})();
	});

	return browserWindow &&
		<BrowserWindow
			width={browserWindow.width}
			height={browserWindow.height}
			left={browserWindow.left}
			top={browserWindow.top}
		>
			<TabBar />
		</BrowserWindow>;
}
