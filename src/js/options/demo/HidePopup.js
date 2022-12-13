import React, { useEffect, useRef, useState } from "react";
import { styled } from "goober";
import { createRecents, createTabs } from "./utils";
import { createAnimOptions, createStepHandler } from "@/options/demo/anim";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import Shortcut from "./Shortcut";
import PlayButton from "@/options/demo/PlayButton";

function getBounds({
	screenLeft: left,
	screenTop: top,
	outerWidth: width,
	outerHeight: height })
{
	return { left, top, width, height };
}

const HidePopupOptions = createAnimOptions(
	[
		["reset", 0],
		"start",
		"down",
		"down",
		["end", 1000],
		["pressDown", 250],
		["pressUp", 1500],
		["pressDown", 250],
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
	margin-left: 1.7em;
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
	tabCount = 10 })
{
	const [tabs] = useState(() => createTabs(tabCount));
	const [recents, setRecents] = useState(createRecents(tabs));
	const [recentIndex, setRecentIndex] = useState(0);
	const [activeTab, setActiveTab] = useState(recents[recentIndex]);
	const [popupVisible, setPopupVisible] = useState(false);
	const [animStarted, setAnimStarted] = useState(false);
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
	const playButtonEnabled = !active && animStarted;

	const startAnim = () => {
		setAnimStarted(true);
		setRecentIndex(0);
		start();
	};

	useEffect(() => {
		if (animStarted) {
			startAnim();
		} else {
				// ignore the change of hidePopupBehavior on first mount, but
				// restart the animation of future changes
			setAnimStarted(true);
		}

		return stop;
	}, [hidePopupBehavior]);

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
					targetWindow={getBounds(window)}
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
					shortcut={shortcut}
				/>
			</ShortcutContainer>
		</Container>
	);
}
