import React from "react";
import { styled } from "goober";
import Key from "@/options/key";
import { getKeysFromShortcut } from "@/options/shortcut-utils";

const Container = styled.div`
	flex-direction: column;
	justify-content: center;
	display: flex;
`;
const ShortcutContainer = styled.div`
	display: inline-block;
	
	& kbd {
		margin-right: .25em;
		transition: transform .15s ease-out;
	}
	
	& kbd:last-of-type {
		margin-right: 0;
	}
`;
const PressableKey = styled(Key)`
	${({ pressed }) => pressed && "transform: translateY(.5em)"};
`;

function Shortcut({
	keys,
	pressed = [] })
{
	const keyStrings = Array.isArray(keys)
		? keys
		: getKeysFromShortcut(keys).keys;

	return (
		<ShortcutContainer>
			{keyStrings.map(key => key &&
				<PressableKey
					key={key}
					code={key}
					pressed={pressed.includes(key)}
				/>)
			}
		</ShortcutContainer>
	);
};

export default function ShortcutDisplay({
	shortcut,
	pressedKeys })
{
	return (
		<Container>
			<Shortcut keys={shortcut} pressed={pressedKeys} />
		</Container>
	);
}
