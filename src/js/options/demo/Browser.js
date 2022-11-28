import React, { useEffect, useState } from "react";
import { styled } from "goober";
import cp from "cp";
import { rndGradient } from "./utils";
import { Window } from "./Window";

const BrowserWindow = styled(Window)`
	background: ${({ bg }) => bg};
`;
const TabBarContainer = styled.div`
	width: 100%;
	height: 5px;
	border-bottom: 4px solid white;
	background: #e8eaed;
	box-sizing: content-box;
	position: relative;
`;
const Tab = styled.div`
	top: 1px;
	left: ${({ left }) => left}%;
	width: ${({ width }) => width}%;
	height: 4px;
	background: white;
	position: absolute;
`;

function createTabs(
	tabCount,
	tabs = [])
{
	if (tabs.length > tabCount) {
		tabs.length = tabCount;
	} else {
		for (let i = tabs.length; i < tabCount; i++) {
			tabs.push(rndGradient());
		}
	}

	return tabs;
}

function TabBar({
	tabCount,
	activeTab })
{
		// add one to the tabCount so that the right edge of the last tab ends
		// at 80% of the browser window width
	const width = (.8 / (tabCount + 1)) * 100;
	const left = width * activeTab;

	return (
		<TabBarContainer>
			<Tab
				width={width}
				left={left}
			/>
		</TabBarContainer>
	)
}

export default function Browser({
	tabCount = 8,
	activeTab = 3 })
{
	const [browserWindow, setBrowserWindow] = useState(null);
	const [tabs, setTabs] = useState(createTabs(tabCount));

	useEffect(() => {
		(async () => {
			const win = await cp.windows.getCurrent();

			setBrowserWindow(win);
		})();
	}, []);

	useEffect(() => {
		setTabs(createTabs(tabCount, tabs));
	}, [tabCount]);

	return browserWindow &&
		<BrowserWindow
			width={browserWindow.width}
			height={browserWindow.height}
			left={browserWindow.left}
			top={browserWindow.top}
			bg={tabs[activeTab]}
		>
			<TabBar
				tabCount={tabCount}
				activeTab={activeTab}
			/>
		</BrowserWindow>;
}
