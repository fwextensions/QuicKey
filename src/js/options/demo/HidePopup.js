import React, { useEffect, useRef, useState } from "react";
import { styled } from "goober";
import { HidePopupBehavior } from "@/background/constants";
import { getWindowBounds } from "./utils";
import { createAnimOptions, createStepHandler } from "./anim";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import Shortcut from "./AnimShortcut";
import PlayButton from "./PlayButton";

const HidePopupOptions = createAnimOptions(
	[
		["reset", 0],
		"start",
		"down",
		"down",
		["end", 1000],
		["pressDown", 350],
		["pressUp", 1500],
		["pressDown", 350],
		["pressUp", 1000],
			// add a last noop step so there's a delay before the play button is shown
		"noop"
	],
	{
		delay: 1250,
		autoStart: false
	}
);

const Container = styled.div`
	margin-top: 2em;
	gap: 2em;
	display: flex;
`;
const ShortcutContainer = styled.div`
	flex-direction: column;
	justify-content: center;
	display: flex;
`;

export default function HidePopup({
	width = 250,
	height,
	shortcut,
	hidePopupBehavior,
	autoStart,
	tabs: initialTabs,
	recents: initialRecents })
{
	const [tabs, setTabs] = useState([...initialTabs]);
	const [recents, setRecents] = useState([...initialRecents]);
	const [recentIndex, setRecentIndex] = useState(0);
	const [activeTab, setActiveTab] = useState(recents[recentIndex]);
	const [popupVisible, setPopupVisible] = useState(false);
	const isLoaded = useRef(false);
	const shortcutRef = useRef();
	const handleStep = createStepHandler({
		shortcut,
		shortcutRef,
		recents,
		setRecentIndex,
		setActiveTab,
		setPopupVisible,
		updateRecents() {
				// move the current tab to the front of the recents stack
			recents.unshift(...recents.splice(recentIndex, 1));
			setRecents(recents);
			setRecentIndex(0);
			setActiveTab(recents[0])
		},
	});
	const { start, stop, active } = useStepper(handleStep, HidePopupOptions);
	const recentTabs = recents.map((index) => tabs[index]);
	const playButtonEnabled = !active && (isLoaded.current || !autoStart);

	const startAnim = () => {
		setRecentIndex(0);
		start();
	};

	useEffect(() => {
			// ignore the change of hidePopupBehavior on first mount, but
			// restart the animation on future changes, or if autoStart is true
		if (isLoaded.current || autoStart) {
			startAnim();
		}

		if (hidePopupBehavior == HidePopupBehavior.Tab) {
				// add a fake tab to account for the tab into which the popup
				// will be hidden, so the tab widths shrink
			setTabs(tabs.concat({}));
		} else if (tabs.length !== initialTabs.length) {
				// restore the actual tab count
			tabs.length = initialTabs.length;
			setTabs(tabs);
		}

		return stop;
	}, [hidePopupBehavior]);

	useEffect(() => {
		isLoaded.current = true;
	}, []);

	return (
		<Container>
			<DemoRoot
				width={width}
				height={height}
			>
				<Browser
					tabs={tabs}
					activeTab={activeTab}
				/>
				<Popup
					recents={recentTabs}
					selected={recentIndex}
					alignment="center-center"
					targetWindow={getWindowBounds(window)}
					visible={popupVisible}
					hideBehavior={hidePopupBehavior}
				/>
				<PlayButton
					enabled={playButtonEnabled}
					title={playButtonEnabled ? "Play demo" : ""}
					onClick={playButtonEnabled ? startAnim : undefined}
				/>
			</DemoRoot>
			<ShortcutContainer>
				<Shortcut
					ref={shortcutRef}
					shortcut={shortcut}
				/>
			</ShortcutContainer>
		</Container>
	);
}
