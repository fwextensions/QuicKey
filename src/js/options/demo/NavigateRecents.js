import React, { useEffect, useRef, useState } from "react";
import { styled } from "goober";
import { getKeysFromShortcut } from "@/options/shortcut-utils";
import { createRecents, createTabs } from "./utils";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import Shortcut from "./Shortcut";

const StepFunctions = {
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
};
const Steps = (({ start, down, end, pressDown, pressUp }) => [
	start,
	down,
	down,
	[end, 1500],
	[pressDown, 250],
	[pressUp, 1500],
	[pressDown, 250],
	[pressUp, 1500],
])(StepFunctions);
const StepperOptions = {
	steps: Steps,
	delay: 1250,
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
	tabCount = 10 })
{
	const [tabs] = useState(() => createTabs(tabCount));
	const [recents, setRecents] = useState(createRecents(tabs));
	const [recentIndex, setRecentIndex] = useState(0);
	const [popupVisible, setPopupVisible] = useState(false);
	const shortcutRef = useRef();
	const shortcutInfo = getKeysFromShortcut(previousShortcut);
	const handleStep = (step) => step({
		shortcut: shortcutInfo,
		setRecentIndex,
		setPopupVisible,
		updateRecents,
		recents,
		key(action, ...args) {
			shortcutRef.current[`key${action[0].toUpperCase() + action.slice(1)}`](...args);
		}
	});
	const { start, stop } = useStepper(handleStep, StepperOptions);
	const recentTabs = recents.map((index) => tabs[index]);

	const updateRecents = () => {
			// move the current tab to the front of the recents stack
		recents.unshift(...recents.splice(recentIndex, 1));
		setRecents(recents);
		setRecentIndex(0);
	};

	useEffect(() => {
		setTimeout(start, 2000);

			// make sure the stepper stops if we're unmounted
		return stop;
	}, []);

	return (
		<Container onClick={(event) => { event.preventDefault(); start(); }}>
			<DemoRoot
				width={width}
				height={height}
			>
				<Browser
					tabs={tabs}
					activeTab={recents[recentIndex]}
				/>
				<Popup
					recents={recentTabs}
					selected={recentIndex}
					alignment="right-center"
					visible={popupVisible}
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
