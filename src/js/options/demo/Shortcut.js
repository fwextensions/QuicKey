import React, {
	createRef,
	forwardRef,
	useImperativeHandle,
	useRef,
} from "react";
import { styled } from "goober";
import Key from "@/options/key";
import { getKeysFromShortcut } from "@/options/shortcut-utils";

const PressKeyframes = [
	{ transform: "translateY(0)" },
	{ transform: "translateY(.5em)" },
];
const PressOptions = {
	duration: 200,
	easing: "ease-out",
	direction: "alternate",
	iterations: 2,
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
`;

export default forwardRef(function Shortcut(
	{ shortcut },
	ref)
{
	const keyRefs = useRef({});
	const shortcutInfo = getKeysFromShortcut(shortcut);

	useImperativeHandle(ref, () => ({
		press(
			key)
		{
			const keyRef = keyRefs.current[key.toLowerCase()]?.current;

			if (keyRef) {
				keyRef.animate(PressKeyframes, PressOptions);
			}
		}
	}));

	return (
		<Container>
			{shortcutInfo.keys.map(key => {
				const ref = (keyRefs.current[key] = createRef());

				return (
					<Key
						ref={ref}
						key={key}
						code={key}
					/>
				);
			})}
		</Container>
	);
});
