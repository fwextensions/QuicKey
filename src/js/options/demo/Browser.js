import React, { useEffect, useState } from "react";
import { styled } from "goober";
import { getWindowBounds } from "@/options/demo/utils";
import { Window } from "./Window";

const BrowserWindow = styled(Window)`
	@media (prefers-color-scheme: dark) {
		--tab-container: #202124;
		--tab-background: #35363a;
		--location-bar: var(--tab-container);
	}
		
	--tab-container: #dee1e6;
	--tab-background: white;
	--location-bar: #eee;
	
	z-index: 20;
`;
const Background = styled.div`
	width: 110%;
	height: 110%;
	top: -5%;
	left: -5%;
	filter: blur(5px);
	position: absolute;
	${({ bg }) => bg}
`;
const TabBarContainer = styled.div`
	width: 100%;
	height: 5px;
	background: var(--tab-container);
	position: relative;
`;
const LocationBar = styled.div`
	width: 100%;
	height: 5px;
	border: 1px solid var(--tab-background);
	border-width: 1px 40px 1px 10px;
	background: var(--location-bar);
	position: relative;
`;
const QuicKeyIcon = styled.div`
	@media (prefers-color-scheme: dark) {
		--default-icon: #cecac9;
		--navigating-icon: #282c2d;
	}
		
	--default-icon: #282c2d;
	--navigating-icon: #cecac9;
	
	top: 0;
	right: -6px;
	width: 3px;
	height: 3px;
	background: var(--${({ navigating }) => navigating ? "navigating" : "default"}-icon);
	position: absolute;
`;
	// add an after element to cover up the divider lines on the right side,
	// since there's no easy way to limit the number of them
const TabDividers = styled.div`
	@media (prefers-color-scheme: dark) {
		--divider: #5e5f61;
	}
		
	left: 0;
	top: 1px;
	width: 100%;
	height: 3px;
	background: inherit;
    background-image: linear-gradient(to right, transparent 95%, var(--divider, #aaa) 2%);
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
	background: var(--tab-background);
	border-radius: 2px 2px 0 0;
	position: absolute;
	box-shadow: -2px 0 0 var(--tab-background);
`;
const TabName = styled.div`
	font-weight: 500;
	font-size: 1rem;
	left: .6em;
	bottom: .4em;
	color: white;
	opacity: .8;
	position: absolute;
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
	navigating = false,
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
			{...props}
		>
			<Background bg={tabs[activeTab].background} />
			<TabBar
				tabCount={tabs.length}
				activeTab={activeTab}
			/>
			<LocationBar>
				<QuicKeyIcon navigating={navigating} />
			</LocationBar>
			<TabName>
				Tab {activeTab + 1}
			</TabName>
		</BrowserWindow>
	);
}
