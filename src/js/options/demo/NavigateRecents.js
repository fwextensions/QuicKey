import React, { useEffect, useRef, useState } from "react";
import { styled } from "goober";
import { getKeysFromShortcut } from "@/options/shortcut-utils";
import { createRecents, createTabs } from "./utils";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import Shortcut from "./Shortcut";
import PlayButton from "@/options/demo/PlayButton";

const Noop = () => {};
const StepFunctions = {
	reset({ setPopupVisible, setRecentIndex, setNavigating, shortcut, key }) {
		key("reset", ...shortcut.keys);
		setPopupVisible(false);
		setNavigating(false);
		setRecentIndex(0);
	},
	start({ setPopupVisible, setRecentIndex, shortcut, key, recents }) {
		key("down", ...shortcut.modifiers);
		key("press", shortcut.baseKey);
		setPopupVisible(true);
		setRecentIndex((recentIndex) => (recentIndex + 1) % recents.length);
	},
	down({ setRecentIndex, shortcut, key, recents }) {
		key("press", shortcut.baseKey);
		setRecentIndex((recentIndex) => (recentIndex + 1) % recents.length);
	},
	end({ setPopupVisible, updateRecents, shortcut, key }) {
		key("up", ...shortcut.modifiers);
		setPopupVisible(false);
		updateRecents();
	},
	pressDown({ setPopupVisible, setRecentIndex, shortcut, key }) {
		key("down", ...shortcut.keys);
		setPopupVisible(true);
		setRecentIndex(1);
	},
	pressUp({ setPopupVisible, updateRecents, shortcut, key }) {
		key("up", ...shortcut.keys);
		setPopupVisible(false);
		updateRecents();
	},
	startPreviousTab({ setNavigating }) {
		setNavigating(true);
	},
	pressPreviousTab({ setRecentIndex, shortcut, key, recents }) {
		key("press", ...shortcut.keys);
		setRecentIndex((recentIndex) => (recentIndex + 1) % recents.length);
	},
	endPreviousTab({ setNavigating, updateRecents }) {
		setNavigating(false);
		updateRecents();
	},
};
const PopupRecentsSteps = (({ reset, start, down, end, pressDown, pressUp }) => [
	[reset, 0],
	start,
	down,
	down,
	[end, 1500],
	[pressDown, 250],
	[pressUp, 1500],
	[pressDown, 250],
	[pressUp, 1000],
		// add a last noop step so there's a delay before the play button is shown
	Noop
])(StepFunctions);
const PopupRecentsOptions = {
	steps: PopupRecentsSteps,
	delay: 1250,
	autoStart: false
};
const KeyboardRecentsSteps = (({ reset, startPreviousTab, pressPreviousTab, endPreviousTab }) => [
	[reset, 0],
	[startPreviousTab, 0],
	pressPreviousTab,
	pressPreviousTab,
	pressPreviousTab,
	[endPreviousTab, 1500],
	[startPreviousTab, 0],
	[pressPreviousTab, 1250],
	[endPreviousTab, 1500],
	[startPreviousTab, 0],
	[pressPreviousTab, 1250],
	[endPreviousTab, 1000],
	Noop
])(StepFunctions);
const KeyboardRecentsOptions = {
	steps: KeyboardRecentsSteps,
	delay: 1000,
	autoStart: false
};

const Container = styled.div`
	margin: 2em 0 0 0;
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
	previousShortcut,
	navigateWithPopup,
	tabCount = 10 })
{
	const [tabs] = useState(() => createTabs(tabCount));
	const [recents, setRecents] = useState(createRecents(tabs));
	const [recentIndex, setRecentIndex] = useState(0);
	const [popupVisible, setPopupVisible] = useState(false);
	const [navigating, setNavigating] = useState(false);
	const [animStarted, setAnimStarted] = useState(false);
	const shortcutRef = useRef();
	const handleStep = (step) => step({
		shortcut: getKeysFromShortcut(previousShortcut),
		setRecentIndex,
		setPopupVisible,
		setNavigating,
		updateRecents,
		recents,
		key(action, ...args) {
			shortcutRef.current[`key${action[0].toUpperCase() + action.slice(1)}`](...args);
		}
	});
	const { start, stop, active } = useStepper(handleStep, navigateWithPopup ? PopupRecentsOptions : KeyboardRecentsOptions);
	const recentTabs = recents.map((index) => tabs[index]);
	const playButtonEnabled = !active && animStarted;

	const updateRecents = () => {
			// move the current tab to the front of the recents stack
		recents.unshift(...recents.splice(recentIndex, 1));
		setRecents(recents);
		setRecentIndex(0);
	};

	const startAnim = () => {
		setAnimStarted(true);
		setRecentIndex(0);
		start();
	};

	useEffect(() => {
			// we only want to restart the animation if it's already been
			// started, since this effect will run when the component is mounted
			// and autoStart might be set to false
		if (animStarted) {
			startAnim();
		}
	}, [navigateWithPopup]);

	useEffect(() => {
		setTimeout(startAnim, 1000);

			// make sure the stepper stops if we're unmounted
		return stop;
	}, []);

	return (
		<Container onClick={(event) => event.preventDefault()}>
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
				<Shortcut
					ref={shortcutRef}
					shortcut={previousShortcut}
				/>
			</ShortcutContainer>
		</Container>
	);
}
