import React, { useEffect, useRef, useState } from "react";
import { styled } from "goober";
import { IsMac, HidePopupBehavior, CommandIDs } from "@/background/constants";
import { ShortcutSeparator } from "@/options/key-constants";
import { getKeysFromShortcut } from "@/options/shortcut-utils";
import { getWindowBounds } from "./utils";
import { createAnimOptions, createStepHandler } from "./anim";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import AnimShortcut from "./AnimShortcut";
import PlayButton from "./PlayButton";

function shiftPress({
	key,
	shortcut,
	moveSelection })
{
	key("press", shortcut.baseKey);
	moveSelection(-1);
}

function shiftEnd({ setPopupVisible, updateRecents, shortcut, key })
{
	key("up", "shift", ...shortcut.modifiers);
	setPopupVisible(false);
	updateRecents();
}

const HidePopupOptions = createAnimOptions(
	[
		["reset", 0],
		"start",
		"down",
		["down", 800],
		["down", 600],
		["down", 1000],
		[(context) => context.setIncludeShift(true), 300],
		(context) => context.key("down", "shift"),
		shiftPress,
		shiftPress,
		[shiftEnd, 750],
		[(context) => context.setIncludeShift(false), 1500],
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
const AutoStartDelay = 1500;
	// get the suggested key for the open popup command from the manifest based
	// on the OS, and then generate the same info object that will be passed in
	// from the PopupSection.  we'll use that shortcut when showing the HidePopup
	// demo below and there's no default shortcut set, so that the animation has
	// some keys to show getting pressed.
const SuggestedOpenPopupCommand = chrome.runtime.getManifest()
	.commands[CommandIDs.OpenPopupCommand]
	.suggested_key[IsMac ? "mac" : "default"]
	.replace("MacCtrl", "Ctrl")
	.toLowerCase();
const DefaultOpenPopupShortcut = {
	shortcut: SuggestedOpenPopupCommand,
	...getKeysFromShortcut(SuggestedOpenPopupCommand)
};

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
	const [startAnim, setStartAnim] = useState(null);
	const [includeShift, setIncludeShift] = useState(false);
	const isMounted = useRef(false);
	const shortcutRef = useRef();
		// when animating and there's no shortcut set, fall back to the default
	const animShortcut = !shortcut.shortcut
		? DefaultOpenPopupShortcut
		: shortcut;
	const handleStep = createStepHandler({
		shortcut: animShortcut,
		shortcutRef,
		recents,
		setRecentIndex,
		setRecents,
		setActiveTab,
		setPopupVisible,
		setIncludeShift,
	});
	const { start, stop, active } = useStepper(handleStep, HidePopupOptions);
	const recentTabs = recents.map((index) => tabs[index]);
	const playButtonEnabled = !active && (isMounted.current || !autoStart);
		// always use the real shortcut string when not animating (i.e., !active)
	const currentShortcutString = !active
		? shortcut.shortcut
		: includeShift
			? [...animShortcut.modifiers, "shift", animShortcut.baseKey].join(ShortcutSeparator)
			: animShortcut.shortcut;

	useEffect(() => {
			// the "restart" state should force the anim to restart even if it's
			// already playing.  we have to control the animation via a state
			// flag so that the timeout and click handlers don't use stale values.
		if (startAnim == "restart" || (startAnim == "start" && !active)) {
			setRecentIndex(0);
			start();
		}

		setStartAnim(null);
	}, [startAnim, start]);

	useEffect(() => {
			// ignore the change of hidePopupBehavior on first mount, but
			// restart the animation on future changes.  this will force a
			// restart of the animation, even if it's already going, so it's
			// always showing the current hide behavior.
		if (isMounted.current) {
			setStartAnim("restart");
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

		// this effect has to be at the end, so that the previous one sees
		// isMounted as false when it's first run
	useEffect(() => {
		isMounted.current = true;

		if (autoStart) {
				// when the component is mounted, start the animation after a
				// slight delay, so the user doesn't miss the beginning of it
			setTimeout(() => setStartAnim("start"), AutoStartDelay);
		}
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
					mode="normal"
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
					onClick={playButtonEnabled ? () => setStartAnim("start") : undefined}
				/>
			</DemoRoot>
			<ShortcutContainer>
				<AnimShortcut
					ref={shortcutRef}
					shortcut={currentShortcutString}
				/>
			</ShortcutContainer>
		</Container>
	);
}
