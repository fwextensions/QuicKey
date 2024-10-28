import trackers from "./page-trackers";


const StorageKeys = [
	"version",
	"data",
	"lastSavedFrom"
];
const LockNameBase = "storage://";


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


export function createStorage({
	name = "default",
	version = 1,
	getDefaultData = emptyDefaultData,
	validateUpdate = alwaysValidate,
	updaters = {} })
{
	const storageLocation = globalThis.location.pathname;
	const lockName = LockNameBase + name;
	let dataPromise = initialize();
	let lastSavedFrom;


	function initialize()
	{
			// pass null to get everything in storage
		return chrome.storage.local.get(null)
			.then(storage => {
				lastSavedFrom = storage?.lastSavedFrom;

				if (!storage || !storage.data) {
						// this is likely a new install, so reset the storage
						// to the default.  we need to do this without locking
						// the mutex because doTask() locks it and then calls
						// this promise, so if we called the locking reset
						// from here, it would never complete.
					return resetWithoutLocking();
				} else {
						// update the existing storage to the latest version,
						// if necessary
					return update(storage);
				}
			});
	}


	async function update(
		storage)
	{
		let updated = false;
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
			updated = await validateUpdate(storage.data);
		}

		if (updated) {
				// save the updated data and version to storage
			return saveWithVersion(storage.data);
		} else {
			const failure = storage.version === version ?
				"failed-validation" : "failed-update";

DEBUG && console.error(`Storage error: ${failure}`, storage);
			trackers.background.event("storage", failure);

				// store a global reference to the bad data object so we can
				// examine it and recover data in devtools
			globalThis.FAILED_STORAGE = storage;

				// we couldn't find a way to update the existing storage to
				// the new version or the update resulted in invalid data,
				// so just reset it to the default
			return resetWithoutLocking();
		}
	}


	function saveWithVersion(
		data)
	{
		dataPromise = Promise.resolve(data);
		lastSavedFrom = storageLocation;

		return chrome.storage.local.set({ version, data, lastSavedFrom: storageLocation })
			.then(() => structuredClone(data));
	}


	function resetWithoutLocking()
	{
			// remove just the storage keys we actually use, rather than clearing everything
		return chrome.storage.local.remove(StorageKeys)
			.then(getDefaultData)
			.then(saveWithVersion)
				// normally, dataPromise points to the resolved promise from
				// getAll() that was created when createStorage() was first
				// called and returns the in-memory copy of the data from
				// storage.  but since we just cleared that, we need to
				// update the promise to point to the fresh data in memory.
			.then(data => dataPromise = Promise.resolve(data));
	}


	function doTask(
		task,
		saveResult)
	{
		return navigator.locks.request(lockName, async () => {
			const { data } = await chrome.storage.local.get(null);
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
		return doTask(resetWithoutLocking);
	}


	return {
		get version() { return version; },
		get,
		set,
		reset
	};
}
