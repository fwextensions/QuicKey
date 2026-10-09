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
	// how long to let entries accumulate before writing them.  each write costs
	// a read and a write of the whole log, so a burst that would have been one
	// storage round trip per line becomes one for the burst.  keep it short:
	// anything still buffered when the worker is killed is lost, and the point
	// of this log is to survive exactly that.
const FlushDelay = 1000;
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


	// entries waiting to be written, and the flush they'll go out in
let pendingEntries = [];
let flushTimer = null;
let flushPromise = Promise.resolve();
let resolveFlush = null;
	// serialize writes within this context so concurrent flushes don't
	// clobber each other while waiting for the cross-context lock
let queue = Promise.resolve();


	// write whatever has accumulated.  reading and writing the whole log on
	// every line was costing 50-100KB of storage traffic per line, on the same
	// storage the tasks being logged were waiting on
export function flushLog()
{
	const resolvePending = resolveFlush;

	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}

	resolveFlush = null;

	if (!pendingEntries.length) {
			// a flush called early still has to settle the promise log()
			// handed out, or a caller awaiting it would hang forever
		resolvePending?.(queue);

		return queue;
	}

	const entriesToWrite = pendingEntries;

	pendingEntries = [];
	queue = queue
		.then(() => navigator.locks.request(LockName, async () => {
			const { [LogKey]: entries = [] } = await chrome.storage.local.get(LogKey);

			entries.push(...entriesToWrite);
			entries.splice(0, Math.max(entries.length - MaxEntries, 0));

			await chrome.storage.local.set({ [LogKey]: entries });
		}))
			// never let a logging failure break the caller's promise chain
		.catch(console.error);

	resolvePending?.(queue);

	return queue;
}


export default function log(
	...args)
{
		// only write the log in dev.  DEBUG defaults to IsDev, so this is on for
		// an unpacked extension and off for anything installed from the store,
		// and can still be flipped by hand in the console.  it has to be read
		// here rather than at module scope, since error-handler.js is what
		// assigns it and may not have run by the time this module is imported.
	if (!globalThis.DEBUG) {
		return flushPromise;
	}

	const entry = {
		time: Date.now(),
		context: Context,
		message: args.map(stringify).join(" ")
	};

		// also echo to the console so live debugging still works
	console.log("[log]", ...args);

	pendingEntries.push(entry);

	if (!flushTimer) {
			// the returned promise resolves when this batch has been written,
			// so a caller that awaits log() still waits for its own entry
		flushPromise = new Promise(resolve => resolveFlush = resolve);
		flushTimer = setTimeout(flushLog, FlushDelay);
	}

	return flushPromise;
}


export async function printLog(
	count = MaxEntries)
{
		// write anything still buffered, so printing from the console shows
		// the lines that just scrolled by rather than stopping a beat short
	await flushLog();

	const { [LogKey]: entries = [] } = await chrome.storage.local.get(LogKey);
	const rows = entries.slice(-count).map(({ time, context, message }) => {
		const date = new Date(time);
		const day = date.toLocaleDateString("en-CA");
		const ms = String(date.getMilliseconds()).padStart(3, "0");
		const msTime = date.toLocaleTimeString().replace(" ", `.${ms} `);

		return `${day} ${msTime}  ${context}  ${message}`;
	});

	console.log("\n" + rows.join("\n"));

	return entries;
}


export function clearLog()
{
	pendingEntries = [];
	flushLog();

	return chrome.storage.local.remove(LogKey);
}


	// make these available in the devtools console of whatever context
	// loads this module (service worker, popup, options page)
globalThis.printLog = printLog;
globalThis.clearLog = clearLog;
globalThis.flushLog = flushLog;
