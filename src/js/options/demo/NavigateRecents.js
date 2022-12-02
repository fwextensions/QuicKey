import React, { useRef, useState } from "react";
import { styled } from "goober";
import { linearGradient, rnd, rndGradientValues } from "./utils";
import useStepper from "./useStepper";
import { DemoRoot } from "./DemoRoot";
import Browser from "./Browser";
import Popup from "./Popup";
import Shortcut from "./Shortcut";

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
	if (tabs.length > tabCount) {
		tabs.length = tabCount;
	} else {
		for (let i = tabs.length; i < tabCount; i++) {
			const gradient = rndGradientValues();

			tabs.push({
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
	const [tabs] = useState(createTabs(tabCount));
	const [recents] = useState(shuffle(Array.from(Array(tabCount).keys())));
	const [index, setIndex] = useState(0);
	const shortcutRef = useRef();
		// create an array of tabs sorted by recency
	const recentTabs = recents.map((index) => tabs[index]);

	useStepper((index) => {
		setIndex(index % tabCount);
		shortcutRef.current.press("A");
	}, { from: 1, to: 3, delay: 1250 });

	return (
		<Container onClick={(event) => event.preventDefault()}>
			<DemoRoot
				width={width}
				height={height}
			>
				<Browser
					tabs={tabs}
					activeTab={recents[index]}
					onClick={() => setIndex((index + 1) % tabCount)}
				/>
				<Popup
					tabs={recentTabs}
					tabCount={tabCount}
					selected={index}
					alignment="right-center"
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
