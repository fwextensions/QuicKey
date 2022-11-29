import React, { useEffect, useState } from "react";
import { styled } from "goober";
import { rndGradient } from "./utils";
import { Window } from "./Window";

function getWindowBounds()
{
	const { screenLeft: left, screenTop: top, outerWidth: width, outerHeight: height } = window;

	return { left, top, width, height };
}

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

const BrowserWindow = styled(Window)`
	background: ${({ bg }) => bg};
`;
const TabBarContainer = styled.div`
	width: 100%;
	height: 9px;
	border-bottom: 4px solid white;
	background: #e8eaed;
	position: relative;
`;
	// add an after element to cover up the divider lines on the right side,
	// since there's no easy way to limit the number of them
const TabDividers = styled.div`
	left: 0;
	top: 1px;
	width: 100%;
	height: 3px;
    background-image: linear-gradient(to right, transparent 95%, #cfcfcf 2%);
    background-position: 0 0;
    background-repeat: repeat-x;
    background-size: ${({ tabWidth }) => tabWidth}% 3px;
	position: absolute;
	
	&:after {
		content: " ";
		width: 15%;
		height: 3px;
		right: 0;
		top: 0;
		background: #e8eaed;
		position: absolute;
	}
`;
	// add a shadow on the left to make sure the divider there is covered
const Tab = styled.div`
	top: 1px;
	left: ${({ left }) => left}%;
	width: ${({ width }) => width}%;
	height: 4px;
	background: white;
	position: absolute;
	box-shadow: -2px 0 0 white;
`;

function TabBar({
	tabCount,
	activeTab })
{
	const width = (.85 / (tabCount)) * 100;
	const left = width * activeTab;

	return (
		<TabBarContainer
			tabWidth={width}
		>
			<TabDividers
				tabWidth={width}
			/>
			<Tab
				width={width}
				left={left}
			/>
		</TabBarContainer>
	);
}

export default function Browser({
	tabCount = 8,
	activeTab = 3,
	...props })
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
			left={bounds.left}
			top={bounds.top}
			width={bounds.width}
			height={bounds.height}
			bg={tabs[activeTab]}
			{...props}
		>
			<TabBar
				tabCount={tabCount}
				activeTab={activeTab}
			/>
		</BrowserWindow>
	);
}
