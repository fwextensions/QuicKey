import React from "react";
import { styled } from "goober";
import { calcPosition } from "@/background/popup-utils";
import { Window } from "./Window";

const RowHeight = 7;

const PopupWindow = styled(Window)`
	opacity: ${({ visible }) => visible ? 1 : 0};
	transition: opacity .15s ease-out;
`;
const Selection = styled.div`
	top: ${({ index }) => index * RowHeight}px;
	width: 100%;
	height: ${RowHeight}px;
	border: 1px solid white;
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
	alignment = "center-center",
	visible })
{
	const { left, top, width: popupW, height: popupH } = calcPosition(null, { alignment });

	return (
		<PopupWindow
			left={left}
			top={top}
			width={popupW}
			height={popupH}
			visible={visible}
		>
			<Selection index={selected} />
			<Tabs>
				{recents.map((tab, i) => <Tab key={i} tab={tab} />)}
			</Tabs>
		</PopupWindow>
	);
}
