import React from "react";
import { styled } from "goober";

const Container = styled.div`
	@media (prefers-color-scheme: dark) {
		fill: white;
	}
		
	fill: rgb(0, 0, 50);
	opacity: ${({ enabled }) => enabled ? "var(--opacity, .3)" : 0};
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
	
	&:hover {
		opacity: ${({ enabled }) => enabled ? "var(--opacity-hover, .5)" : 0};
	}
	
	&:hover:active {
		opacity: ${({ enabled }) => enabled ? "var(--opacity-active, .7)" : 0};
		transition: none;
	}
	
	& svg {
		width: 40px;
		margin-left: 10px;
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
