import { styled } from "goober";
import { Rect } from "./Rect";

export const Window = styled(Rect)`
	@media (prefers-color-scheme: dark) {
		--border-color: #444;
		--shadow: rgba(68, 68, 68, .7);
		background-color: #202124;
	}
		
	background-color: white;
	border: 1px solid var(--border-color, #cacaca);
	border-radius: 4px;
	box-shadow: 0 2px 6px var(--shadow, rgba(0, 0, 0, .1));
`;
