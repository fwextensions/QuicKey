	// a persistent debug log stored in chrome.storage.local, so that events
	// that happen around a Chrome restart can be examined afterwards.  the
	// service worker console is destroyed when Chrome quits, so any normal
	// console.log() output from the startup/restore sequence is lost by the
	// time a problem is noticed.  this log survives restarts (it's stored
	// under its own key, which is NOT in the list of keys cleared by a
	// storage reset, so a reset event itself will be visible in the log).
	//
	// dump the log from the service worker console with:  printLog()
	// clear it with:  clearLog()

const LogKey = "debugLog";
const LockName = "storage://debugLog";
const MaxEntries = 400;
	// track which context wrote each entry, since both the service worker
	// and the popup/menu pages use the storage module
const Context = globalThis.location?.pathname ?? "unknown";


function stringify(
	value)
{
	if (typeof value === "string") {
		return value;
	}

	try {
			// JSON.stringify(undefined) returns undefined, not a string
		return JSON.stringify(value) ?? String(value);
	} catch (e) {
		return String(value);
	}
}


	// serialize writes within this context so concurrent log() calls don't
	// clobber each other while waiting for the cross-context lock
let queue = Promise.resolve();

export default function log(
	...args)
{
	const entry = {
		time: Date.now(),
		context: Context,
		message: args.map(stringify).join(" ")
	};

		// also echo to the console so live debugging still works
	globalThis.DEBUG && console.log("[log]", ...args);

	queue = queue
		.then(() => navigator.locks.request(LockName, async () => {
			const { [LogKey]: entries = [] } = await chrome.storage.local.get(LogKey);

			entries.push(entry);
			entries.splice(0, Math.max(entries.length - MaxEntries, 0));

			await chrome.storage.local.set({ [LogKey]: entries });
		}))
			// never let a logging failure break the caller's promise chain
		.catch(console.error);

	return queue;
}


export async function printLog(
	count = MaxEntries)
{
	const { [LogKey]: entries = [] } = await chrome.storage.local.get(LogKey);
	const rows = entries.slice(-count).map(({ time, context, message }) =>
		`${new Date(time).toISOString()} ${context}  ${message}`);

	console.log("\n" + rows.join("\n"));

	return entries;
}


export function clearLog()
{
	return chrome.storage.local.remove(LogKey);
}


	// make these available in the devtools console of whatever context
	// loads this module (service worker, popup, options page)
globalThis.printLog = printLog;
globalThis.clearLog = clearLog;
