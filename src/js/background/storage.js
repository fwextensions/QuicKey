import trackers from "./page-trackers";
import log from "./persistent-log";


const StorageKeys = [
	"version",
	"data",
	"lastSavedFrom"
];
const LockNameBase = "storage://";
	// deliberately not in StorageKeys, so a reset doesn't wipe the evidence of
	// what caused it
const FailedDataKey = "failedStorageData";
const MaxFailedDataLength = 10000;
const MaxLoggedKeys = 20;


	// describe the data we're about to throw away.  when it isn't the object we
	// expect, its keys are just indexes, which say nothing and can run to
	// thousands of entries, so report the type and a sample instead of dumping
	// the whole thing into the log.
function describeData(
	data)
{
	const type = Object.prototype.toString.call(data);

	if (!data || typeof data !== "object") {
		return `${type} ${JSON.stringify(String(data).slice(0, 200))}`;
	}

	const keys = Object.keys(data);
	const sample = keys.length > MaxLoggedKeys
		? `${JSON.stringify(keys.slice(0, MaxLoggedKeys))}...`
		: JSON.stringify(keys);

	return `${type} ${keys.length} keys: ${sample}`;
}


	// the bad data is the only evidence of what went wrong, and the
	// globalThis.FAILED_STORAGE below dies with the context that saw it, which
	// is almost always the popup.  so keep a copy in storage, where it survives
	// the popup closing and the reset we're about to do.
function saveFailedData(
	storage)
{
	let json;

	try {
		json = JSON.stringify(storage.data);
	} catch (e) {
		json = String(storage.data);
	}

	return chrome.storage.local.set({
		[FailedDataKey]: {
			time: Date.now(),
			from: globalThis.location.pathname,
			version: storage.version,
			description: describeData(storage.data),
				// this can be the whole recents list, so store just enough to
				// tell what the value actually was
			json: String(json).slice(0, MaxFailedDataLength)
		}
	})
			// we're already in a failure path, so a failure to record it
			// shouldn't stop us from resetting to something usable
		.catch(console.error);
}


	// dump the saved data from the service worker console with: printFailedStorage()
export async function printFailedStorage()
{
	const { [FailedDataKey]: failure } = await chrome.storage.local.get(FailedDataKey);

	if (!failure) {
		console.log("No failed storage data has been recorded.");
	} else {
		console.log(`${new Date(failure.time).toISOString()} ${failure.from} `
			+ `version: ${failure.version}\n${failure.description}\n${failure.json}`);
	}

	return failure;
}


globalThis.printFailedStorage = printFailedStorage;


function emptyDefaultData()
{
	return Promise.resolve({});
}


function alwaysValidate()
{
	return Promise.resolve(true);
}


function returnData(
	data)
{
	return Promise.resolve(data);
}


	// the updaters assume they've been handed an object with the keys their own
	// version had, and validateUpdate() can only check the shape once they've
	// all run, so there's nothing between corrupt storage and code that walks
	// it.  an updater that throws on bad data surfaces as failed-init, which
	// retries forever rather than resetting, since a throw there is normally a
	// transient API failure -- so a profile can wedge instead of recovering.
	//
	// this only asserts what's true at every version: that the data is
	// something the updaters can walk at all.  it can't check the shape,
	// because changing the shape is what the updaters are for -- v4 data has no
	// settings key, and v3 data has two keys the current version doesn't.
function isUpdatable(
	data)
{
	return !!data && typeof data == "object" && !Array.isArray(data)
			// settings didn't exist before v5, so only check it if it's there
		&& (!("settings" in data)
			|| (!!data.settings && typeof data.settings == "object"));
}


export function createStorage({
	name = "default",
	version = 1,
	getDefaultData = emptyDefaultData,
	validateUpdate = alwaysValidate,
	updaters = {} })
{
	const storageLocation = globalThis.location.pathname;
	const lockName = LockNameBase + name;
	let lastSavedFrom;
		// the in-flight load/update/reset of the stored data, which every task
		// waits on before touching storage.  null means it hasn't been started,
		// or that the last attempt failed and the next task should retry.
	let initPromise = null;


		// createStorage() has to return synchronously, so the initial load runs
		// in the background and doTask() blocks on it.  otherwise a set() called
		// during startup can read chrome.storage.local before the initial write
		// lands and get undefined, which is what happens on a new install.
	function ensureInitialized()
	{
		if (!initPromise) {
			initPromise = initialize()
				.catch(error => {
						// the storage APIs can fail for reasons that have nothing
						// to do with us and may not last -- a full disk is the
						// common one -- and in MV3 the worker is short-lived
						// enough that giving up for its whole lifetime is a big
						// hammer.  so clear the promise to let the next task try
						// again, and reject this one so the caller sees the
						// failure instead of a task running against no data.
					initPromise = null;

DEBUG && console.error("Storage error: failed-init", error);
					log("STORAGE ERROR: failed-init", error?.message);
					trackers.background.event("storage", "failed-init");

					throw error;
				});
		}

		return initPromise;
	}


	function initialize()
	{
			// pass null to get everything in storage
		return chrome.storage.local.get(null)
			.then(storage => {
				lastSavedFrom = storage?.lastSavedFrom;

				log("storage init:",
					"hasData:", !!storage?.data,
					"version:", storage?.version,
					"lastSavedFrom:", lastSavedFrom,
					"tabIDs:", storage?.data?.tabIDs?.length,
					"lastStartupTime:", storage?.data?.lastStartupTime);

				if (!storage || !storage.data) {
						// this is likely a new install, so reset the storage
						// to the default.  we need to do this without locking
						// the mutex because doTask() locks it and then calls
						// this promise, so if we called the locking reset
						// from here, it would never complete.
					return resetWithoutLocking();
				} else if (!isUpdatable(storage.data)) {
						// there's no version of this we can update, so don't
						// hand it to the updaters just to have one of them
						// throw somewhere in the middle
					return reportBadData("failed-precheck", storage)
						.then(() => resetWithoutLocking(storage.data));
				} else {
						// update the existing storage to the latest version,
						// if necessary
					return update(storage);
				}
			});
	}


		// report the data we're about to throw away, and keep a copy of it, so
		// the reset that follows can be traced back to what caused it
	async function reportBadData(
		failure,
		storage)
	{
DEBUG && console.error(`Storage error: ${failure}`, storage);
			// include the version we expected, since a failed-update means the
			// two disagree, and knowing only the stored one doesn't say whether
			// the storage is ahead of the code or behind it
		log("STORAGE ERROR:", failure,
			"version:", storage.version, "expected:", version,
			"tabIDs:", storage.data?.tabIDs?.length,
			"data:", describeData(storage.data));
		trackers.background.event("storage", failure);

			// store a global reference to the bad data object so we can
			// examine it and recover data in devtools
		globalThis.FAILED_STORAGE = storage;

		await saveFailedData(storage);
	}


	async function update(
		storage)
	{
		const originalVersion = storage.version;
		let valid = false;
		let updater = updaters[storage.version];

		while (updater) {
				// version here is the version to which the storage has just
				// been updated
			const [data, version] = await updater(storage.data, storage.version);

			storage.data = data;
			storage.version = version;

			updater = updaters[storage.version];
		}

		if (storage.version === version) {
			valid = await validateUpdate(storage.data);
		}

		if (valid) {
			if (storage.version !== originalVersion) {
					// save the updated data and version to storage
				return saveWithVersion(storage.data);
			}

				// the stored data is already at the current version, so don't
				// rewrite the whole storage, which would otherwise happen on
				// every startup of the service worker or popup
			return storage.data;
		} else {
			const failure = storage.version === version ?
				"failed-validation" : "failed-update";

			await reportBadData(failure, storage);

				// we couldn't find a way to update the existing storage to
				// the new version or the update resulted in invalid data,
				// so just reset it to the default
			return resetWithoutLocking(storage.data);
		}
	}


	function saveWithVersion(
		data)
	{
		lastSavedFrom = storageLocation;

		return chrome.storage.local.set({ version, data, lastSavedFrom: storageLocation })
			.then(() => structuredClone(data));
	}


		// pass the data being replaced when this is a recovery reset, so
		// getDefaultData() can decide whether any of it is worth carrying over.
		// a reset with nothing passed in is a clean slate.
	function resetWithoutLocking(
		previousData)
	{
			// this wipes tabIDs/tabsByID, so any recent tab history is lost.
			// log it so we can tell whether a missing history after a restart
			// was caused by a reset vs. a failed match in updateFromFreshTabs().
		log("RESETTING STORAGE to defaults");

			// build the replacement data before clearing anything.  it means
			// querying every tab, which takes seconds on a machine with
			// thousands of them, and clearing first would leave storage with no
			// data for that whole window -- long enough for another context to
			// start up, see the empty storage as a new install, and reset again
			// on top of us.
		return getDefaultData(previousData)
				// remove just the storage keys we actually use, rather than
				// clearing everything
			.then(data => chrome.storage.local.remove(StorageKeys)
				.then(() => data))
			.then(saveWithVersion);
	}


	function doTask(
		task,
		saveResult)
	{
		return navigator.locks.request(lockName, async () => {
				// don't read until the initial load or reset has finished
				// writing, so the first task on a new install sees the
				// defaults instead of undefined
			await ensureInitialized();

				// we read from storage on every task rather than keeping an
				// in-memory copy the way the MV2 persistent background page
				// could, since the worker and the popup each get their own
				// copy of this module and have to see each other's writes.
				// only get the data key, since that's all the tasks operate
				// on, so we don't deserialize the other keys on every call
			const { data } = await chrome.storage.local.get("data");
			let result;

			try {
				result = await task(data);

				if (saveResult && result) {
						// the task will probably return only the changed keys,
						// so merge the existing data with the new data, so that
						// we don't lose anything, since everything is stored in
						// a top-level `data` key.  we also want to return the
						// complete set of updated data below.
					result = {
						...data,
						...result
					};
					await chrome.storage.local.set({
						lastSavedFrom: storageLocation,
						data: result
					});
				}
			} catch (error) {
				console.error(error);

				throw error;
			}

			return result;
		});
	}


	function set(
		task)
	{
		return doTask(task, true);
	}


	function get(
		task = returnData)
	{
			// if a function isn't passed in, use a noop function that will
			// just return the data as a promise, so the caller can handle
			// it in a then() chain
		return doTask(task, false);
	}


	function reset()
	{
			// doTask() passes the current data to the task, but an explicit
			// reset is asking for a clean slate, not a recovery, so drop it
		return doTask(() => resetWithoutLocking());
	}


		// start loading now rather than waiting for the first task, since the
		// popup needs the data as soon as it can get it.  swallow the rejection
		// here so a failed load isn't an unhandled rejection -- ensureInitialized()
		// has already reported it, and the task that retries will surface it to
		// a caller that can actually respond.
	ensureInitialized().catch(() => {});

	return {
		get version() { return version; },
		get,
		set,
		reset
	};
}
