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
	//
	// replace any earlier worker's stamp rather than the whole title: a worker
	// that starts while the popup holds control never writes the badge, so it
	// would otherwise wipe out the tab count the popup put in the title.
if (globalThis.DEBUG) {
		// include the date, since a stamp from a previous day's launch would
		// otherwise look like it's from today
	const now = new Date();
	const date = now.toLocaleDateString("en-US",
		{ month: "2-digit", day: "2-digit", year: "numeric" });

	globalThis.workerStartMarker = `(worker started ${date} ${now.toLocaleTimeString()})`;
	chrome.action.getTitle({})
		.then((title) => chrome.action.setTitle({
			title: `${title.replace(/ \(worker started [^)]*\)$/, "")} ${globalThis.workerStartMarker}`
		}))
		.catch(() => {});
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

	// the one cached event whose placeholder listener can't stay attached.  the
	// toolbar menu needs NO onCommand listener anywhere in the extension while
	// it's open, so Chrome passes alt-W and the rest to it as key events --
	// see enableCommands() in commandHandlers.js.
const DetachedEventNames = new Set(["commands.onCommand"]);

function cacheEvents(
	eventNames)
{
		// walk down the dot path specified in name, starting from chrome
	const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);

	let cache = [];
	const listeners = eventNames.map((eventName) => {
		const listener = (...eventArgs) => {
				// after the replay, this is just a placeholder
			if (cache) {
				cache.push([eventName, eventArgs, Date.now()]);
				LoggedEvents.has(eventName) && log("sw caught:", eventName);
			}
		};

		getEvent(eventName).addListener(listener);

		return [eventName, listener];
	});

	return function dispatchCachedEvents(
		loaded)
	{
		const events = cache;

			// stop caching, but leave the listeners attached.  Chrome drops an
			// event's wake-up registration when a worker removes the last
			// listener for it, and then that event never starts the worker
			// again, until something like devtools does.  removing these after
			// background.js threw on import, before adding its own listeners,
			// wiped every registration but the one an earlier module had made,
			// and the shortcuts, tab events and onStartup all went dead.
		cache = null;

		if (!loaded) {
				// there are no real handlers to replay to.  keeping every
				// placeholder, including onCommand's, means the next event
				// starts a fresh worker that can try the import again.
			return;
		}

		for (const [eventName, listener] of listeners) {
			if (DetachedEventNames.has(eventName)) {
				getEvent(eventName).removeListener(listener);
			}
		}

		const cutoff = Date.now() - MaxCachedEventAge;

		for (const [eventName, eventArgs, time] of events) {
			if (time < cutoff) {
				log("sw dropping stale event:", eventName, Date.now() - time, "ms old");
				continue;
			}

			globalThis.DEBUG && console.log("◆ dispatching", eventName, eventArgs);
			LoggedEvents.has(eventName) && log("◆ sw dispatching:", eventName);
			getEvent(eventName).dispatch(...eventArgs);
		}
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

let loaded = false;

try {
	importScripts("./background.js");
	loaded = true;
} catch (error) {
	console.error(error);
		// the console is gone once the worker stops, so keep a record.  the
		// stack says which module threw.
	log("background.js failed to load:", error?.stack || String(error));
}

	// background.js registers all of its listeners while it's evaluated, so
	// from here on every event reaches a real handler.  stop caching and replay
	// the backlog now, rather than after startup's storage task: that task
	// needs the storage lock, which the popup can hold for many minutes when
	// Chrome is struggling, and every event that arrived in the meantime was
	// both handled live and then replayed a second time once it finished.
dispatchCachedEvents(loaded);
