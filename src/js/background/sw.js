import log from "@/background/persistent-log";

	// recommended by wOxxOm for avoiding service worker install issues
	// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/yo_2j-N0-Vg/m/kMDVdhaIAAAJ
globalThis.oninstall = () => skipWaiting();
globalThis.onactivate = () => clients.claim();

	// persistent-log gates on DEBUG, which error-handler.js sets -- but that
	// doesn't run until background.js is imported below, which is too late for
	// anything logged from here.  same default it uses.
globalThis.DEBUG ??= !("update_url" in chrome.runtime.getManifest());

	// in dev, stamp the toolbar icon's tooltip with when this worker started.
	// the title doesn't survive a browser restart, so if it still reads just
	// "QuicKey" hours after one, no worker has run since.  unlike the
	// persistent log, this doesn't depend on chrome.storage answering, and
	// unlike opening devtools, checking it doesn't start the worker.
if (globalThis.DEBUG) {
	globalThis.workerStartMarker = `(worker started ${new Date().toLocaleTimeString()})`;
	chrome.action.setTitle({
		title: `${chrome.runtime.getManifest().short_name} ${globalThis.workerStartMarker}`
	}).catch(() => {});
}

	// these are the ones worth a persistent record, at the earliest point we
	// can take one.  the worker console is lost when the worker is replaced, so
	// a startup handled by an earlier worker instance would leave no trace
	// there; this survives.  logging every cached event would mean a storage
	// write per restored tab, hence the filter.
const LoggedEvents = new Set(["runtime.onStartup", "runtime.onInstalled", "commands.onCommand"]);

	// cached events older than this are dropped rather than replayed.  a
	// command in particular has to run close to when it was pressed or not at
	// all: replaying a toggle after a long stall flips tabs out from under the
	// user, which was seen happening 18 minutes late.
const MaxCachedEventAge = 2000;

function cacheEvents(
	eventNames)
{
		// walk down the dot path specified in name, starting from chrome
	const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);

	let cache = [];
	let listeners = eventNames.map((eventName) => {
		const listener = (...eventArgs) => {
			cache.push([eventName, eventArgs, Date.now()]);
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

		const cutoff = Date.now() - MaxCachedEventAge;

		for (const [eventName, eventArgs, time] of cache) {
			if (time < cutoff) {
				log("sw dropping stale event:", eventName, Date.now() - time, "ms old");
				continue;
			}

			globalThis.DEBUG && console.log("◆ dispatching", eventName, eventArgs);
			LoggedEvents.has(eventName) && log("◆ sw dispatching:", eventName);
			getEvent(eventName).dispatch(...eventArgs);
		}

		cache = null;
		listeners = null;
	}
}

const dispatchCachedEvents = cacheEvents([
	"alarms.onAlarm",
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

	// background.js registers all of its listeners while it's evaluated, so
	// from here on every event reaches a real handler.  stop caching and replay
	// the backlog now, rather than after startup's storage task: that task
	// needs the storage lock, which the popup can hold for many minutes when
	// Chrome is struggling, and every event that arrived in the meantime was
	// both handled live and then replayed a second time once it finished.
dispatchCachedEvents();
