import React from "react";
import { styled } from "goober";
import Shortcut from "@/options/shortcut";

const Container = styled.div`
	flex-direction: column;
	justify-content: center;
	display: flex;
`;

export default function ShortcutDisplay({
	shortcut })
{
	return (
		<Container>
			<Shortcut keys={shortcut} />
		</Container>
	);
}
