import React from "react";
import { styled } from "goober";

const Button = styled.button`
	font-weight: bold;
	font-size: inherit;
	text-decoration: none;
	color: inherit;
	background: none;
	border: none;
	padding: .25em 0;
	margin: 0;
	opacity: .5;
	box-shadow: none;
	
	&:hover {
		text-decoration: underline;
		opacity: .35;
	}
	
	&:hover:active {
		opacity: .8;
	}
`;

export default function TextButton({
	children,
	...props })
{
	return (
		<Button {...props}>
			{children}
		</Button>
	);
}
