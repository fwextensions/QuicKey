import React, { useEffect, useState } from "react";
import { styled } from "goober";
import { rndGradient } from "./utils";
import { Window } from "./Window";

function getWindowBounds()
{
	const { outerWidth: width, outerHeight: height, screenLeft: left, screenTop: top } = window;

	return { width, height, left, top };
}

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
	const [bounds, setBounds] = useState(getWindowBounds());
	const [tabs, setTabs] = useState(createTabs(tabCount));

	useEffect(() => {
		const interval = setInterval(() => {
			setBounds(getWindowBounds());
		}, 1000);

		return (() => clearInterval(interval));
	}, []);

	useEffect(() => {
		setTabs(createTabs(tabCount, tabs));
	}, [tabCount]);

	return (
		<BrowserWindow
			width={bounds.width}
			height={bounds.height}
			left={bounds.left}
			top={bounds.top}
			bg={tabs[activeTab]}
		>
			<TabBar
				tabCount={tabCount}
				activeTab={activeTab}
			/>
		</BrowserWindow>
	);
}
