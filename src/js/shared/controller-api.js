import { connect } from "@/lib/ipc";
import { bindApi } from "@/shared/api";

	// the ipc channel the worker serves the controller's api on
export const ControllerChannel = "controller";

	// the methods on controller.api that the popup calls.  this lives apart
	// from controller.js so callers don't load the controller and everything
	// it imports.
export const ControllerApiNames = [
	"getActiveTab",
	"flushAddTab",
	"stopNavigatingRecents",
];


	// return a client for the controller's api.  when this context holds
	// control, the calls go straight to getController()'s api; otherwise
	// they go over ipc to the worker, which holds control whenever this
	// context doesn't.  each method returns a promise.
export function createControllerClient(
	getController)
{
	let channel;

	return bindApi(
		ControllerApiNames,
		getController && (() => getController().api),
			// open the channel on the first remote call, since a popup that
			// holds control never needs it
		(name, ...args) => (channel ??= connect(ControllerChannel)).call(name, ...args)
	);
}
