import log from "@/background/persistent-log";

	// recommended by wOxxOm for avoiding service worker install issues
	// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/yo_2j-N0-Vg/m/kMDVdhaIAAAJ
globalThis.oninstall = () => skipWaiting();
globalThis.onactivate = () => clients.claim();

	// persistent-log gates on DEBUG, which error-handler.js sets -- but that
	// doesn't run until background.js is imported below, which is too late for
	// anything logged from here.  same default it uses.
globalThis.DEBUG ??= !("update_url" in chrome.runtime.getManifest());

	// these are the ones worth a persistent record, at the earliest point we
	// can take one.  the worker console is lost when the worker is replaced, so
	// a startup handled by an earlier worker instance would leave no trace
	// there; this survives.  logging every cached event would mean a storage
	// write per restored tab, hence the filter.
const LoggedEvents = new Set(["runtime.onStartup", "runtime.onInstalled"]);

function cacheEvents(
	eventNames)
{
		// walk down the dot path specified in name, starting from chrome
	const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);

	let cache = [];
	let listeners = eventNames.map((eventName) => {
		const listener = (...eventArgs) => {
			cache.push([eventName, eventArgs]);
			LoggedEvents.has(eventName) && log("sw caught:", eventName);
		};

		getEvent(eventName).addListener(listener);

		return [eventName, listener];
	});

	return function dispatchCachedEvents()
	{
		for (const [eventName, listener] of listeners) {
			getEvent(eventName).removeListener(listener);
		}

		for (const [eventName, eventArgs] of cache) {
			globalThis.DEBUG && console.log("◆ dispatching", eventName, eventArgs);
			LoggedEvents.has(eventName) && log("◆ sw dispatching:", eventName);
			getEvent(eventName).dispatch(...eventArgs);
		}

		cache = null;
		listeners = null;
	}
}

globalThis.dispatchCachedEvents = cacheEvents([
	"commands.onCommand",
	"runtime.onConnect",
	"runtime.onInstalled",
	"runtime.onMessage",
	"runtime.onStartup",
	"runtime.onUpdateAvailable",
	"tabs.onActivated",
	"tabs.onCreated",
	"tabs.onRemoved",
	"tabs.onReplaced",
	"windows.onFocusChanged",
]);

try {
	importScripts("./background.js");
} catch (err) {
	console.error(err);
}
