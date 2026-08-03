import trackers from "@/background/page-trackers";
import { IsDev } from "@/background/constants";
import stdout from "@/lib/stdout";

	// default DEBUG to true when we're running as an unpacked extension
globalThis.DEBUG = typeof globalThis.DEBUG !== "boolean"
//	? false
	? IsDev
	: globalThis.DEBUG;

if (globalThis.DEBUG) {
	stdout("lconfjbjgbjenjaahemlkoemdafcnhdf");
}

function getStack(
	error)
{
	return (error?.stack?.replace(PathPattern, "")) || "";
}

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
		const {detail, reason = ((detail && detail.reason) || "")} = event;
			// fall back to the reason itself when there's no stack to report,
			// as with a promise rejected with a string, so that we send
			// something more useful than the bare "Caught unhandled" prefix
		const stack = getStack(event.error) || getStack(reason) ||
			String(reason ?? "");
		const type = event.type == "unhandledrejection"
			? "promise rejection"
			: "exception";
		const description = `Caught unhandled ${type}:\n${stack}`;

			// the timestamp stays in the console but is deliberately kept out
			// of what we send to GA.  it made every report a unique string, so
			// two users hitting the same error never aggregated into one row,
			// and it used up room in a field that's truncated long before a
			// useful amount of the stack fits.
		globalThis.DEBUG &&
			console.error(new Date().toLocaleString(), description);
		tracker.exception(description, true);

		if (event.preventDefault) {
			event.preventDefault();
		}
	} catch (e) {
		console.error("Unhandled error in the error handler (oh, the irony!)", e);
	}
}

const PathPattern = /chrome-extension:\/\/[^\n]+\//g;

const match = location.pathname.match(/\/(\w+)\.html/);
const pageName = match?.[1] || "background";
const tracker = trackers[pageName] || trackers.background;
const queuedErrors = globalThis.getQueuedErrors?.();
let loaded = false;

	// only add the event listeners once, even if we get imported multiple times
if (!loaded) {
	loaded = true;
	addEventListener("error", handleError);
	addEventListener("unhandledrejection", handleError);

	if (queuedErrors?.length) {
		queuedErrors.forEach(handleError);
	}
}
