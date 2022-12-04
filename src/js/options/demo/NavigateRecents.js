import React, { useEffect, useRef, useState } from "react";
import { styled } from "goober";
import { getKeysFromShortcut } from "@/options/shortcut-utils";
import { linearGradient, rnd, rndGradientValues } from "./utils";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import Shortcut from "./Shortcut";

const StepRange = { from: 1, to: 4 };
const StepperOptions = {
	...StepRange,
	delay: 1250,
	autoStart: false
};
const StartingHue = rnd(0, 360, true);
const HueJitter = 5;

function shuffle(
	array)
{
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}

	return array;
}

function createTabs(
	tabCount,
	tabs = [])
{
	const hueStep = Math.floor(360 / tabCount);

	if (tabs.length > tabCount) {
		tabs.length = tabCount;
	} else {
		for (let i = tabs.length; i < tabCount; i++) {
				// make sure the hues used for the gradients are spread roughly
				// evenly around the color wheel from each other
			const hue1 = StartingHue + hueStep * i;
			const hue2 = StartingHue + hueStep * i + hueStep * tabCount / 3;
			const gradient = rndGradientValues(
				[hue1 - HueJitter, hue1 + HueJitter],
				[hue2 - HueJitter, hue2 + HueJitter]
			);

			tabs.push({
				id: i,
				length: rnd(20, 80, true),
				favicon: gradient[2],
				gradient: linearGradient(...gradient)
			});
		}
	}

	return tabs;
}

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
	tabCount = 8 })
{
	const [tabs] = useState(() => createTabs(tabCount));
	const [recents, setRecents] = useState(shuffle([...tabs.keys()]));
	const [recentIndex, setRecentIndex] = useState(0);
	const shortcutRef = useRef();
	const { start, active } = useStepper((index) => {
		if (index < StepRange.to) {
			if (index === StepRange.from) {
				shortcutRef.current.keyDown(...shortcutInfo.modifiers);
			}

			shortcutRef.current.keyPress(shortcutInfo.baseKey);
			setRecentIndex(index % tabCount);
		} else {
			shortcutRef.current.keyUp(...shortcutInfo.modifiers);

				// move the current tab to the front of the recents stack
			recents.unshift(...recents.splice(recentIndex, 1));
			setRecents(recents);
			setRecentIndex(0);
		}
	}, StepperOptions);
	const shortcutInfo = getKeysFromShortcut(previousShortcut);
		// create an array of tabs sorted by recency
	const recentTabs = recents.map((index) => tabs[index]);

	useEffect(() => {
		setTimeout(start, 2000);
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
					visible={active}
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
