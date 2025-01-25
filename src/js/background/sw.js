	// recommended by wOxxOm for avoiding service worker install issues
	// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/yo_2j-N0-Vg/m/kMDVdhaIAAAJ
globalThis.oninstall = () => skipWaiting();
globalThis.onactivate = () => clients.claim();

function cacheEvents(
	eventNames)
{
		// walk down the dot path specified in name, starting from chrome
	const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);

	let cache = [];
	let listeners = eventNames.map((eventName) => {
		const listener = (...eventArgs) => cache.push([eventName, eventArgs]);

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
