import React from "react";
import { styled } from "goober";

const Container = styled.div`
	@media (prefers-color-scheme: dark) {
		fill: white;
		mix-blend-mode: lighten;
		--opacity: .4;
		--opacity-hover: .6;
		--opacity-active: .8;
	}
		
	mix-blend-mode: multiply;
	fill: rgb(0, 0, 50);
	opacity: ${({ enabled }) => enabled ? "var(--opacity, .1)" : 0};
	width: 100%;
	height: 100%;
	left: 0;
	top: 0;
	align-items: center;
	position: absolute;
	flex-direction: column;
	justify-content: center;
	display: flex;
	transition: opacity .25s ease-out;
	z-index: 100;
	
	& svg {
		width: 40px;
		margin-left: 10px;
	}
	
	&:hover {
		opacity: ${({ enabled }) => enabled ? "var(--opacity-hover, .3)" : 0};
	}
	
	&:hover:active {
		opacity: ${({ enabled }) => enabled ? "var(--opacity-active, .6)" : 0};
		transition: none;
	}
`;

export default function PlayButton({
	enabled,
	...props })
{
	return (
		<Container
			enabled={enabled}
			{...props}
		>
			<svg viewBox="0 0 100 100">
				<polygon points="14 0, 14 100, 100 50" />
			</svg>
		</Container>
	);
}
