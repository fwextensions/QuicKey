import trackers from "@/background/page-trackers";
import { IsDev } from "@/background/constants";
//import stdout from "@/lib/stdout";

	// default DEBUG to true when we're running as an unpacked extension
globalThis.DEBUG = typeof globalThis.DEBUG !== "boolean"
//	? false
	? IsDev
	: globalThis.DEBUG;

if (globalThis.DEBUG) {
//	stdout("lconfjbjgbjenjaahemlkoemdafcnhdf");
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

	if (!chrome.runtime?.id) {
			// reloading the extension invalidated this context, so it's a page
			// left over from the old build, and every chrome API call it makes
			// will throw "Extension context invalidated".  there's nothing to
			// report -- the tracker can't send from here anyway -- so close the
			// page on its first failure.  control.js does the same if the page
			// is still waiting to claim control, but a page that already held
			// it, like the hidden popup, only finds out when it next calls an
			// API, such as getting the active tab when the window blurs.
		event.preventDefault?.();
		globalThis.document && globalThis.close?.();

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
			// pass the original error too, so PostHog gets its real type and
			// stack frames rather than our prefixed description.  an error
			// event may not have an error object, but it still has the message
			// and location.
		const source = event.type == "unhandledrejection"
			? reason
			: (event.error ?? event);

		tracker.exception(description, true, source);

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
