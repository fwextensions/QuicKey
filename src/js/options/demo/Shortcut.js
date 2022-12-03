import React, {
	createRef,
	forwardRef,
	useImperativeHandle,
	useRef,
} from "react";
import { styled } from "goober";
import Key from "@/options/key";
import { getKeysFromShortcut } from "@/options/shortcut-utils";

const DownKeyframes = [
	{ transform: "translateY(0)" },
	{ transform: "translateY(1em)" },
];
const UpKeyframes = [
	...[...DownKeyframes].reverse()
];
const PressKeyframes = [
	...DownKeyframes,
	...UpKeyframes
];
const UpDownOptions = {
	duration: 200,
	easing: "ease-out",
	fill: "forwards"
};
const PressOptions = {
	duration: 500,
	easing: "ease-out",
	iterations: 1,
};

const Container = styled.div`
	display: inline-block;

	& kbd {
		margin-right: .25em;
		transition: transform .15s ease-out;
	}

	& kbd:last-of-type {
		margin-right: 0;
	}
	
	& > kbd {
		position: relative;
	}
`;
const ShadowKeyContainer = styled.div`
	position: absolute;
	
	& kbd {
		color: transparent;
		opacity: .1;
	}
`;

function animateKeys(
	keys,
	keyRefs,
	frames,
	options)
{
	keys.forEach((key) => {
		const keyRef = keyRefs.current[key.toLowerCase()]?.current;

		if (keyRef) {
			keyRef.animate(frames, options);
		}
	});
}

export default forwardRef(function Shortcut(
	{ shortcut },
	ref)
{
	const keyRefs = useRef({});
	const shortcutInfo = getKeysFromShortcut(shortcut);
	const pressableKeys = shortcutInfo.keys.map(key => {
		const ref = (keyRefs.current[key] = createRef());

		return (
			<Key
				ref={ref}
				key={key}
				code={key}
			/>
		);
	});
	const shadowKeys = shortcutInfo.keys.map(key => <Key key={key} code={key} />);

	useImperativeHandle(ref, () => ({
		keyDown(...keys) { animateKeys(keys, keyRefs, DownKeyframes, UpDownOptions); },
		keyUp(...keys) { animateKeys(keys, keyRefs, UpKeyframes, UpDownOptions); },
		keyPress(...keys) { animateKeys(keys, keyRefs, PressKeyframes, PressOptions); }
	}));

	return (
		<Container>
			<ShadowKeyContainer>
				{shadowKeys}
			</ShadowKeyContainer>
			{pressableKeys}
		</Container>
	);
});
