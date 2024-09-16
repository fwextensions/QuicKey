import trackers from "../background/page-trackers";


function getStack(
	error)
{
	return (error && error.stack && error.stack.replace(PathPattern, "")) || "";
}


const PathPattern = /chrome-extension:\/\/[^\n]+\//g;


const match = location.pathname.match(/\/(\w+)\.html/);
const pageName = match?.[1] || "background";
const tracker = trackers[pageName] || trackers.background;


function handleError(
	event)
{
	if (event.defaultPrevented) {
			// the devtools console in Chromium v102 triggers
			// unhandled errors while you type, with defaultPrevented
			// set to true.  so ignore those errors, but only if
			// they weren't queued while we were starting up, which
			// mean they're legitimate.
		return;
	}

	try {
		const timestamp = new Date().toLocaleString();
		const {detail, reason = ((detail && detail.reason) || "")} = event;
		const stack = getStack(event.error) || getStack(reason);
		const type = event.type == "unhandledrejection"
			? "promise rejection"
			: "exception";
		const errorMessage = `Caught unhandled ${type} at ${timestamp}:\n${stack}`;

		DEBUG && console.error(errorMessage);
		tracker.exception(errorMessage, true);

		if (event.preventDefault) {
			event.preventDefault();
		}
	} catch (e) {
		console.error("Unhandled error in the error handler (oh, the irony!)", e);
	}
}

addEventListener("error", handleError);
addEventListener("unhandledrejection", handleError);
