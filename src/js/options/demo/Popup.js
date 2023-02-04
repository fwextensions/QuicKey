import React from "react";
import { styled } from "goober";
import { HidePopupBehavior } from "@/background/constants";
import { calcPosition } from "@/background/popup-utils";
import { Window } from "./Window";

const RowHeight = 7;

function getMinimizedBounds()
{
	const { width, height } = screen;
	const minimizedW = width * .05;
	const minimizedH = minimizedW * .5;

	return {
		left: width * .2,
		top: height - minimizedH,
		width: minimizedW,
		height: minimizedH
	};
}

const PopupWindow = styled(Window)`
	@media (prefers-color-scheme: dark) {
		--popup-background: #202124;
	}
	
	--popup-background: white;
	
	background: var(--popup-background);
	transition: all .15s ease-out;
	z-index: 50;

	&.closed {
		opacity: 0;
		background: none;
		box-shadow: none;
	}

	&.behind {
		z-index: 10;
	}
	
	&.tab > *, &.minimize > * {
		display: none;
	}
	
	&.tab, &.minimize {
		border: none;
		border-radius: 0;
		transition-duration: .3s;
		background: yellow;
		box-shadow: none;
	}
`;
const HiddenWindowBorder = styled(Window)`
	background: none;
	opacity: .3;
	border: 2px dashed yellow;
	mix-blend-mode: screen;
	z-index: 50;
`;
const Selection = styled.div`
	@media (prefers-color-scheme: dark) {
		background: #444547;
	}

	top: ${({ index }) => index * RowHeight}px;
	width: 100%;
	height: ${RowHeight}px;
	border: 1px solid var(--popup-background);
	border-left-width: 2px;
    border-right-width: 2px;
	background: #ebebeb;
	position: absolute;
`;
const Tabs = styled.div`
	position: relative;
`;
const TabItem = styled.div`
	width: 100%;
	flex-direction: row;
	display: flex;
`;
const Favicon = styled.div`
	width: 3px;
	height: 3px;
	margin: 2px;
	background: ${({ color }) => color};
`;
const Title = styled.div`
	@media (prefers-color-scheme: dark) {
		background: #aaa;
	}
	
	width: ${({ width }) => width}%;
	height: 1px;
	margin: 3px 0;
	background: #aaa;
`;

function Tab({
	tab })
{
	return (
		<TabItem>
			<Favicon color={tab.favicon}/>
			<Title width={tab.length} />
		</TabItem>
	);
}

export default function Popup({
	recents,
	selected = 0,
	targetWindow = null,
	alignment = "center-center",
	visible,
	hideBehavior = "closed" })
{
	let bounds;

		// for the navigate recents with popup demo, hideBehavior will be empty
		// and targetWindow will be null, so the popup will be positioned
		// relative to the screen
	if (visible || hideBehavior === HidePopupBehavior.Behind || hideBehavior === "closed") {
		bounds = calcPosition(targetWindow, { alignment });
	} else if (hideBehavior === HidePopupBehavior.Minimize) {
		bounds = getMinimizedBounds();
	} else {
			// if we change the TabBar layout in the Browser component, we'll
			// need to update this calculation
		const width = (.85 / (recents.length)) * targetWindow.width;
		const left = targetWindow.left + (width * (recents.length - 1));

			// these top and height values are a little arbitrary, and work for
			// a 1440p monitor, but may not work for all
		bounds = {
			left,
			top: targetWindow.top + 18,
			width,
			height: 42
		};
	}

	return (
		<>
			<PopupWindow
				{...bounds}
				className={visible ? "visible" : hideBehavior}
			>
				<Selection index={selected} />
				<Tabs>
					{recents.map((tab, i) => <Tab key={i} tab={tab} />)}
				</Tabs>
			</PopupWindow>
			{(hideBehavior === HidePopupBehavior.Behind) &&
				<HiddenWindowBorder {...bounds} />
			}
		</>
	);
}
