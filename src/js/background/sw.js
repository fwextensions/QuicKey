	// recommended by wOxxOm for avoiding service worker install issues
	// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/yo_2j-N0-Vg/m/kMDVdhaIAAAJ
globalThis.oninstall = () => skipWaiting();
globalThis.onactivate = () => clients.claim();

function cacheEvents(
	eventTypes)
{
	let events = [];
	let listeners = eventTypes.map((eventType) => {
		const listener = (...eventArgs) => events.push([eventType, eventArgs]);

		eventType.addListener(listener);

		return [eventType, listener];
	});

	return function dispatchCachedEvents()
	{
console.error("---- dispatchCachedEvents", performance.now(), events.length, listeners.length);

		for (const [eventType, listener] of listeners) {
			eventType.removeListener(listener);
		}

		for (const [eventType, eventArgs] of events) {
			eventType.dispatch(...eventArgs);
		}

		events = null;
		listeners = null;
	}
}

globalThis.dispatchCachedEvents = cacheEvents([
	chrome.commands.onCommand,
	chrome.runtime.onConnect,
	chrome.runtime.onInstalled,
	chrome.runtime.onMessage,
	chrome.runtime.onStartup,
	chrome.runtime.onUpdateAvailable,
	chrome.storage.onChanged,
	chrome.tabs.onActivated,
	chrome.tabs.onCreated,
	chrome.tabs.onRemoved,
	chrome.tabs.onReplaced,
	chrome.windows.onFocusChanged,
]);

importScripts("./background.js");
