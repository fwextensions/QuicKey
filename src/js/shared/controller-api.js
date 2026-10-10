import { bindApi, sendApiMessage } from "@/shared/api";

	// the methods on controller.api that other contexts call.  this lives
	// apart from controller.js so the options page can call them without
	// loading the controller and everything it imports.
export const ControllerApiNames = [
	"getActiveTab",
	"flushAddTab",
	"stopNavigatingRecents",
	"applySetting",
];


	// return a client for the controller's api.  when this context holds
	// control, the calls go straight to getController()'s api; otherwise they
	// go to the context that does hold it.  each method returns a promise.
export function createControllerClient(
	getController)
{
	return bindApi(
		ControllerApiNames,
		getController && (() => getController().api),
		sendApiMessage
	);
}
