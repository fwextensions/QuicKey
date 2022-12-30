import { styled } from "goober";
import { Rect } from "./Rect";

export const Window = styled(Rect)`
	@media (prefers-color-scheme: dark) {
		--border-color: #222;
		--shadow: rgba(255, 255, 255, .1);
		background: #202124;
	}
		
	background: white;
	border: 1px solid var(--border-color, #cacaca);
	border-radius: 4px;
	box-shadow: 0 2px 6px var(--shadow, rgba(0, 0, 0, .1));
`;
