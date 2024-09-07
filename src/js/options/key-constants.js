import {IsMac} from "@/background/constants";


export const KeyOrder = {
	ctrl: 0,
	control: 0,
	mod: IsMac ? 3 : 0,
	alt: 1,
	opt: 1,
		// ignore the Windows key on Windows
	meta: IsMac ? 1 : -1,
	shift: 2,
	cmd: 3,
	char: 4
};
export const ModifierAliases = {
	alt: IsMac ? "opt" : "alt",
	mod: IsMac ? "cmd" : "ctrl",
	control: "ctrl",
		// ignore the Windows key on Windows
	meta: IsMac ? "cmd" : ""
};
export const ModifierEventNames = {
	alt: "Alt",
	opt: "Alt",
	ctrl: "Control",
	cmd: "Meta"
};
export const ModKeyBoolean = IsMac ? "metaKey" : "ctrlKey";
export const ShortcutSeparator = "+";
export const FunctionKeyPattern = /^F\d{1,2}$/i
