import React from "react";
import { styled } from "goober";
import { IsMac, HidePopupBehavior, PopupInnerWidth, PopupInnerHeight } from "@/background/constants";
import { calcBounds } from "@/background/popup-utils";
import { Window } from "./Window";

const RowHeight = 65;

function getMinimizedBounds()
{
	const { width, height, availHeight } = screen;
	const taskbarH = height - availHeight;
	const minimizedW = taskbarH * (IsMac ? 1 : 2);
	const minimizedH = taskbarH;

		// on macOS, we make the minimized window a square icon and position it
		// towards the right edge of the dock, where minimized windows go
	return {
		left: width * (IsMac ? .7 : .2),
		top: height - minimizedH,
		width: minimizedW,
		height: minimizedH
	};
}

function getScreenBounds()
{
		// we don't want to use screen.availLeft/Top because we want the origin
		// to start at 0,0 even if we're on a monitor to the left of the main one
	return {
		left: 0,
		top: 0,
		width: screen.availWidth,
		height: screen.availHeight
	};
}

const PopupWindow = styled(Window)`
	@media (prefers-color-scheme: dark) {
		--popup-background: #202124;
	}
	
	--popup-background: white;
	--row-height: calc(${RowHeight} * var(--px));
	
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
	
	&.minimize {
			/* put the minimized window above the taskbar */
		z-index: 80;
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
		background: hsl(240, 40%, 60%);
	}

	top: calc(${({ index }) => index} * var(--row-height));
	width: 100%;
	height: var(--row-height);
	border: 1px solid var(--popup-background);
	background: hsl(240, 90%, 93%);
	position: absolute;
`;
const Tabs = styled.div`
	position: relative;
`;
const TabItem = styled.div`
	width: 100%;
	height: var(--row-height);
	flex-direction: row;
	display: flex;
	align-items: center;
`;
const Favicon = styled.div`
	width: calc(32 * var(--px)); 
	height: calc(32 * var(--px)); 
	margin: 5%;
`;
	// we use a min-height below because the titles don't look great if the calc'd
	// height is ~1.5 and some end up at 1px and others at 2px
const Title = styled.div`
	@media (prefers-color-scheme: dark) {
		background: #aaa;
	}
	
	height: calc(16 * var(--px));
	min-height: 2px;
	background: #aaa;
`;

function Tab({
	tab })
{
		// use styles to customize each component instead of passing a value into
		// the CSS so that we don't generate a separate class for each element
	return (
		<TabItem>
			<Favicon style={{ background: tab.favicon }} />
			<Title style={{ width: tab.length + "%" }} />
		</TabItem>
	);
}

export default function Popup({
	mode,
	recents,
	selected = 0,
	targetWindow = getScreenBounds(),
	alignment = "center-center",
	visible,
	hideBehavior = "closed" })
{
		// mode controls whether we show the current tab in the results list.  the
		// selected prop is always based on the full recents list, so we have to
		// adjust it when hiding the current tab.
	const resultsList = recents.slice(mode == "normal" ? 1 : 0);
	const resultsListSelection = mode == "normal" ? selected - 1 : selected;
	let bounds;

		// for the navigate recents with popup demo, hideBehavior will be empty
		// and targetWindow will be the screen bounds, so the popup will be positioned
		// relative to the screen
	if (visible || hideBehavior === HidePopupBehavior.Behind || hideBehavior === "closed") {
		bounds = calcBounds(targetWindow, { alignment, width: PopupInnerWidth, height: PopupInnerHeight });
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
				<Selection index={resultsListSelection} />
				<Tabs>
					{resultsList.map((tab, i) => <Tab key={i} tab={tab} />)}
				</Tabs>
			</PopupWindow>
			{(hideBehavior === HidePopupBehavior.Behind && !visible) &&
				<HiddenWindowBorder {...bounds} />
			}
		</>
	);
}
