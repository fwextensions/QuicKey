import React, { createContext, useContext, useEffect, useState } from "react";
import { styled } from "goober";
import cp from "cp";
import { calcPosition } from "@/background/popup-utils";

const DemoContext = createContext();

function useScaled()
{
	const {scale} = useContext(DemoContext);

	return (value) => `${value * scale}px`;
}

function Rect({
	width,
	height,
	left,
	top,
	className,
	children })
{
	const scaled = useScaled();
	const style = {
		width: scaled(width),
		height: scaled(height),
		position: "relative",
		overflow: "hidden"
	};

	if (Number.isFinite(left)) {
		style.left = scaled(left);
		style.position = "absolute";
	}

	if (Number.isFinite(top)) {
		style.top = scaled(top);
		style.position = "absolute";
	}

	return (
		<div
			className={className}
			style={style}
		>
			{children}
		</div>
	);
}

const Screen = styled(Rect)`
	background: white;
	border: 1px solid #eee;
	margin: 2em auto 0;
`;
const Window = styled(Rect)`
	background: white;
	border: 1px solid #ddd;
	border-radius: 4px;
	box-shadow: 0 2px 6px rgba(0, 0, 0, .1);
`;
const TabBar = styled.div`
	width: 100%;
	height: 6px;
	background: #e8eaed;
`;

function DemoRoot({
	width,
	height })
{
	const [browserWindow, setBrowserWindow] = useState(null);
	const { width: screenW, height: screenH } = window.screen;
	const { left, top, width: popupW, height: popupH } = calcPosition(null, { alignment: "right-center" });
	let scale = .1;

	if (Number.isFinite(width)) {
		scale = width / screenW;
	} else if (Number.isFinite(height)) {
		scale = height / screenH;
	}

	useEffect(() => {
		(async () => {
			const win = await cp.windows.getCurrent();

			setBrowserWindow(win);
		})();
	});

	return (
		<DemoContext.Provider value={{ scale }}>
			<Screen
				width={screenW}
				height={screenH}
			>
				{browserWindow &&
					<Window
						width={browserWindow.width}
						height={browserWindow.height}
						left={browserWindow.left}
						top={browserWindow.top}
					>
						<TabBar />
					</Window>
				}
				<Window
					width={popupW}
					height={popupH}
					left={left}
					top={top}
				/>
			</Screen>
		</DemoContext.Provider>
	);
}

export default function NavigateRecents({
	width = 250,
	height })
{
// TODO: move browserWindow into here?

	return (
		<DemoRoot
			width={width}
			height={height}
		/>
	);
}
