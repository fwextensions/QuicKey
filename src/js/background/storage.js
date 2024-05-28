import { deepEqual } from "fast-equals";
import cp from "cp";
import Mutex from "./mutex";
import trackers from "./page-trackers";


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
	return data;
}


function isNewDataEqual(
	newData,
	data)
{
		// newData and data should normally be non-null, but check just in case
	if (typeof newData === "object" && typeof data === "object" && newData && data) {
		return Object.keys(newData).every((key) => deepEqual(newData[key], data[key]));
	}

	return false;
}


export default function createStorage({
	version = 1,
	getDefaultData = emptyDefaultData,
	validateUpdate = alwaysValidate,
	updaters = {} })
{
	const storageMutex = new Mutex(Promise);
	const storageLocation = globalThis.location.pathname;
	let dataPromise = initialize();
	let lastSavedFrom;


	chrome.storage.onChanged.addListener((changes, area) => {
		const changedLocation = changes?.lastSavedFrom?.newValue;

		if (area === "local" && (changedLocation || lastSavedFrom) !== storageLocation) {
				// this storage has been updated from a different thread, so set
				// the dataPromise to null so that the next call to getAll() will
				// reload the storage and pick up the latest data
			dataPromise = null;
console.log("==== storage.onChanged", changedLocation || lastSavedFrom, storageLocation, dataPromise, changes);
// TODO: instead of nulling the dataPromise, save the new data to our cache.
//  or just always create a new resolved promise with the new data, regardless of
//  what the lastSavedFrom is.  don't even need to track that then, or create a
//  new promise in save(), though there's enough of a delay in getting onChanged
//  that we may still want to update in save().
		}
	});


	function initialize()
	{
const t = performance.now();

			// pass null to get everything in storage
		return cp.storage.local.get(null)
			.then(storage => {
console.log(`--- INITIALIZE ${storageLocation}: loaded storage in`, performance.now() - t, "ms");
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


	function getAll()
	{
		if (!dataPromise) {
const t = performance.now();
				// pass null to get everything in storage, since the cache is empty
			dataPromise = cp.storage.local.get(null)
				.then(storage => {
console.log(`--- ${storageLocation}: loaded storage in`, performance.now() - t, "ms");

					lastSavedFrom = storage.lastSavedFrom;

					return storage.data;
				});
		}

		return dataPromise;
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
			window.FAILED_STORAGE = storage;

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

		return cp.storage.local.set({ version, data, lastSavedFrom: storageLocation })
			.then(() => structuredClone(data));
	}


	function save(
		data)
	{
			// point our cache promise to the new data
		dataPromise = Promise.resolve(data);
		lastSavedFrom = storageLocation;

		return cp.storage.local.set({ data, lastSavedFrom: storageLocation })
				// return a clone of the changed data so that whatever's next in
				// the chain can use it without affecting the cache
			.then(() => structuredClone(data));
	}


	function resetWithoutLocking()
	{
		return cp.storage.local.clear()
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
		thisArg,
		saveResult)
	{
		return storageMutex.lock(() => getAll()
				// we have to clone the data before passing it to the task function,
				// so that any changes it makes to the data won't be reflected in
				// the cached storage.  when can then compare newData to what's
				// in the cache and only call save() if it actually changed.  by
				// only saving when there's an actual change, we don't have to
				// bust the cache in the other thread unnecessarily.
			.then(data => Promise.resolve(task.call(thisArg, structuredClone(data)))
				.then(newData => {
					if (saveResult && newData && !isNewDataEqual(newData, data)) {
							// since all the values are stored on the .data
							// key of the storage instead of at the topmost
							// level, we need to update that object with the
							// changed data before calling save().
							// otherwise, we'd lose any values that weren't
							// changed and returned by the task function.
						Object.assign(data, newData);
console.log("==== SAVE", storageLocation, newData);

						return save(data);
					} else {
//isNewDataEqual(newData, data) && console.log("==== NO CHANGE", storageLocation, newData, data);
						return newData;
					}
				})));
	}


	function set(
		task,
		thisArg)
	{
		return doTask(task, thisArg, true);
	}


	function get(
		task,
		thisArg)
	{
			// if a function isn't passed in, use a noop function that will
			// just return the data as a promise, so the caller can handle
			// it in a then() chain
		return doTask(task || returnData, thisArg, false);
	}


	function reset()
	{
		return storageMutex.lock(resetWithoutLocking);
	}


	return {
		get version() { return version; },
		get,
		set,
		reset
	};
}
