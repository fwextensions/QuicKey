import React, { useEffect, useRef, useState } from "react";
import { styled } from "goober";
import { createAnimOptions, createStepHandler } from "@/options/demo/anim";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import AnimShortcut from "./AnimShortcut";
import PlayButton from "@/options/demo/PlayButton";

const PopupRecentsOptions = createAnimOptions(
	[
		["reset", 0],
		"start",
		"down",
		"down",
		["end", 1500],
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
const KeyboardRecentsOptions = createAnimOptions(
	[
		["reset", 0],
		["startPreviousTab", 0],
		"pressPreviousTab",
		"pressPreviousTab",
		"pressPreviousTab",
		["endPreviousTab", 1500],
		["startPreviousTab", 0],
		["pressPreviousTab", 1250],
		["endPreviousTab", 1500],
		["startPreviousTab", 0],
		["pressPreviousTab", 1250],
		["endPreviousTab", 1000],
		"noop"
	],
	{
		delay: 1000,
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

export default function NavigateRecents({
	width = 250,
	height,
	shortcut,
	navigateWithPopup,
	autoStart,
	tabs,
	recents: initialRecents })
{
	const [recents, setRecents] = useState([...initialRecents]);
	const [recentIndex, setRecentIndex] = useState(0);
	const [popupVisible, setPopupVisible] = useState(false);
	const [navigating, setNavigating] = useState(false);
	const isLoaded = useRef(false);
	const shortcutRef = useRef();
	const handleStep = createStepHandler({
		shortcut,
		shortcutRef,
		recents,
		setRecentIndex,
		setRecents,
		setActiveTab() {},
		setPopupVisible,
		setNavigating,
	});
	const { start, stop, active } = useStepper(handleStep, navigateWithPopup ? PopupRecentsOptions : KeyboardRecentsOptions);
	const recentTabs = recents.map((index) => tabs[index]);
	const playButtonEnabled = !active && (isLoaded.current || !autoStart);

	const startAnim = () => {
		setRecentIndex(0);
		start();
	};

	useEffect(() => {
			// we only want to restart the animation if it's already been
			// started, since this effect will run when the component is mounted
			// and autoStart might be set to false
		if (isLoaded.current || autoStart) {
			startAnim();
		}

		return stop;
	}, [navigateWithPopup]);

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
					activeTab={recents[recentIndex]}
					navigating={navigating}
				/>
				<Popup
					mode="navigate-recents"
					recents={recentTabs}
					selected={recentIndex}
					alignment="right-center"
					visible={popupVisible}
				/>
				<PlayButton
					enabled={playButtonEnabled}
					title={playButtonEnabled ? "Play demo" : ""}
					onClick={playButtonEnabled ? startAnim : undefined}
				/>
			</DemoRoot>
			<ShortcutContainer>
				<AnimShortcut
					ref={shortcutRef}
					shortcut={shortcut.shortcut}
				/>
			</ShortcutContainer>
		</Container>
	);
}
