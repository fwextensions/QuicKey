import { connect } from "@/lib/ipc";
import { bindApi } from "@/shared/api";
import popupWindow from "@/background/popup-window";

const Methods = [
	"show",
	"hide",
	"blur",
	"resize",
];

	// call the popupWindow methods directly when this page holds control, or
	// else through ipc to the worker's popupWindow
export function connectPopupWindow()
{
	const { call } = connect("popup-window");

	return bindApi(Methods, () => popupWindow, call);
}
