import React, { useEffect, useState } from "react";
import { styled } from "goober";
import { Window } from "./Window";

function getWindowBounds()
{
	const { screenLeft: left, screenTop: top, outerWidth: width, outerHeight: height } = window;

	return { left, top, width, height };
}

const BrowserWindow = styled(Window)`
	background: ${({ bg }) => bg};
`;
const TabBarContainer = styled.div`
	width: 100%;
	height: 10px;
	border-bottom: 5px solid white;
	background: #dee1e6;
	position: relative;
`;
	// add an after element to cover up the divider lines on the right side,
	// since there's no easy way to limit the number of them
const TabDividers = styled.div`
	left: 0;
	top: 1px;
	width: 100%;
	height: 3px;
	background: inherit;
    background-image: linear-gradient(to right, transparent 95%, #aaa 2%);
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
		background: inherit;
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
	tabs,
	activeTab = 3,
	...props })
{
		// store the bounds as a string so that it won't trigger a render unless
		// the values themselves change.  otherwise, we'd render with every
		// interval tick since getWindowBounds() creates a new object each time.
	const [boundsJSON, setBoundsJSON] = useState(JSON.stringify(getWindowBounds()));
	const bounds = JSON.parse(boundsJSON);

	useEffect(() => {
		const interval = setInterval(() => {
			setBoundsJSON(JSON.stringify(getWindowBounds()));
		}, 300);

		return () => clearInterval(interval);
	}, []);

	return (
		<BrowserWindow
			left={bounds.left}
			top={bounds.top}
			width={bounds.width}
			height={bounds.height}
			bg={tabs[activeTab].gradient}
			{...props}
		>
			<TabBar
				tabCount={tabs.length}
				activeTab={activeTab}
			/>
		</BrowserWindow>
	);
}
