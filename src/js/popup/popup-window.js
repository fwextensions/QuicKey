import { connect } from "@/lib/ipc";
import popupWindow from "@/background/popup-window";
import control from "@/shared/control";

const Methods = [
	"show",
	"hide",
	"blur",
	"resize",
];

// TODO: add this to the event controller somehow, maybe just send messages instead of calling the popup API directly
export function connectPopupWindow()
{
	const { call } = connect("popup-window");
	const methodEntries = Methods.map((name) => [
		name,
		(...args) => {
			if (control.isHeld()) {
					// the popup has control, so call the popupWindow method directly
				return popupWindow[name](...args);
			} else {
					// the background has control, so make an IPC call to the
					// background code
				return call(name, ...args);
			}
		}
	]);

	return Object.fromEntries(methodEntries);
}
