import { connect } from "@/lib/ipc";

const Methods = [
	"show",
	"hide",
	"blur",
	"resize",
];

export function connectPopupWindow()
{
	const { call } = connect("popup-window");
	const methodEntries = Methods.map((name) => [name, (...args) => call(name, ...args)]);

	return Object.fromEntries(methodEntries);
}
