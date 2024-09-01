import { deepEqual } from "fast-equals";
import { connect } from "@/lib/ipc";
import { PromiseWithResolvers } from "@/lib/promise-with-resolvers";
import Mutex from "./mutex";
import trackers from "./page-trackers";


const StorageKeys = [
	"version",
	"data",
	"lastSavedFrom"
];


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


function isNewDataDifferent(
	newData,
	data)
{
		// newData and data should normally be non-null, but check just in case.
		// we compare the keys of just newData, rather than the whole of newData
		// vs. data, because newData will usually be a subset.
	if (typeof newData === "object" && typeof data === "object" && newData && data) {
		return !Object.keys(newData).every((key) => deepEqual(newData[key], data[key]));
	}

	return false;
}


export function createStorage({
	version = 1,
	getDefaultData = emptyDefaultData,
	validateUpdate = alwaysValidate,
	updaters = {} })
{
	const { receive } = connect("storage");
	const storageMutex = new Mutex();
	const storageLocation = globalThis.location.pathname;
	const promisesByCallID = new Map();
	let dataPromise = initialize();
	let lastSavedFrom;


	receive({
		get(
			id,
			channel)
		{
			const taskPromise = channel.createPromise();

			promisesByCallID.set(id, taskPromise);

				// call get with a promise that will be resolved when we get the
				// "done" call below.  we don't return the promise from get() because
				// we want to hand control back to the caller now, so it can later
				// call back with "done".
			get((data) => taskPromise);
		},

		set(
			id,
			channel)
		{
			const taskPromise = channel.createPromise();

			promisesByCallID.set(id, taskPromise);

				// call set with a promise that will be resolved when we get the
				// "done" call below.  we don't return the promise from set() because
				// we want to hand control back to the caller now, so it can later
				// call back with "done".
			set((data) => taskPromise);
		},

		done(
			id,
			newData)
		{
			const taskPromise = promisesByCallID.get(id);
			const returnPromise = new PromiseWithResolvers();

			if (!taskPromise) {
				throw new Error("done() received unknown ID: " + id);
			}

				// after the newData has been merged with the existing data and
				// saved to storage, we want to send that updated data back to
				// our caller, by resolving returnPromise with it.  the doTask()
				// function in the storage client can then return it to whatever
				// was awaiting storage.set() in that thread.
			taskPromise.then((data) => returnPromise.resolve(data));

				// tell the task we created above in set() to complete, which
				// will clear the storage mutex lock
			taskPromise.resolve(newData);
			promisesByCallID.delete(id);

			return returnPromise;
		}
	});


	function initialize()
	{
//const t = performance.now();

			// pass null to get everything in storage
		return chrome.storage.local.get(null)
			.then(storage => {
//console.log(`--- INITIALIZE ${storageLocation}: loaded storage in`, performance.now() - t, "ms");
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
//const t = performance.now();
			// pass null to get everything in storage, since the cache is empty
		dataPromise = chrome.storage.local.get(null)
			.then(storage => {
//console.log(`--- ${storageLocation}: loaded storage in`, performance.now() - t, "ms");

				lastSavedFrom = storage.lastSavedFrom;

				return storage.data;
			});

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


	function save(
		data)
	{
			// point our cache promise to the new data
		dataPromise = Promise.resolve(data);
		lastSavedFrom = storageLocation;

		return chrome.storage.local.set({ data, lastSavedFrom: storageLocation })
				// return a clone of the changed data so that whatever's next in
				// the chain can use it without affecting the cache
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
		return storageMutex.lock(() => getAll()
				// we have to clone the data before passing it to the task function,
				// so that any changes it makes to the data won't be reflected in
				// the cached storage.  when can then compare newData to what's
				// in the cache and only call save() if it actually changed.  by
				// only saving when there's an actual change, we don't have to
				// bust the cache in the other thread unnecessarily.
			.then(data => Promise.resolve(task.call(null, structuredClone(data)))
				.then(newData => {
					if (saveResult && newData && isNewDataDifferent(newData, data)) {
							// since all the values are stored on the .data
							// key of the storage instead of at the topmost
							// level, we need to update that object with the
							// changed data before calling save().
							// otherwise, we'd lose any values that weren't
							// changed and returned by the task function.
						Object.assign(data, newData);

						return save(data);
					} else {
						return newData;
					}
				})));
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
		return storageMutex.lock(resetWithoutLocking);
	}


	return {
		get version() { return version; },
		get,
		set,
		reset
	};
}


export function createStorageClient(
	clientName)
{
  	const { call } = connect("storage/" + clientName);
	const storageLocation = globalThis.location.pathname;
	let dataPromise = chrome.storage.local.get(null).then(({ data }) => data);
	let currentTaskID = 0;
//	let totalTime = 0;
//	let taskCount = 0;
	let lastSavedFrom;


	chrome.storage.onChanged.addListener((changes, area) => {
		const changedData = changes?.data?.newValue;
		const changedLocation = changes?.lastSavedFrom?.newValue;

		if (area === "local" && changedData && (changedLocation || lastSavedFrom) !== storageLocation) {
				// the storage was changed in the background, so update our cache
			dataPromise = Promise.resolve(changedData);
			lastSavedFrom = changedLocation || lastSavedFrom;
		}
	});


	function getAll()
	{
//const t = performance.now();
			// pass null to get everything in storage, since the cache is empty
		dataPromise = chrome.storage.local.get(null)
			.then(storage => {
//console.log(`--- ${storageLocation}: loaded storage in`, performance.now() - t, "ms");

				lastSavedFrom = storage.lastSavedFrom;

				return storage.data;
			});

		return dataPromise;
	}


	async function get(
		task)
	{
		if (!task) {
				// when the caller doesn't pass in a task, it's usually to just
				// get settings, which don't change quickly, so we don't need to
				// get the most up-to-date data from the background.  just
				// return the in-memory copy of the data.
			return dataPromise;
		}

		const id = currentTaskID++;

			// call get() in the background to lock the storage mutex
		await call("get", id);

			// get the storage by calling the API directly in this thread, which
			// seems to be slower than doing it in the background, but it's still
			// about 1/3 faster overall because we don't have the overhead of
			// marshalling the data to return it via messaging
		const data = await getAll();

		const newData = await task(data);

		return call("done", id, null)
			.then(() => newData);
	}


	async function set(
		task)
	{
//const t = performance.now();

		const id = currentTaskID++;

//console.error("\n\n>>>> SET before SAVE", id, storageLocation, "\n" + String(task).slice(0, 100));
//console.log("\n\n>>>> SET before SAVE", id, storageLocation, "\n" + String(task).slice(0, 100));
//console.time(`======= DO TASK ${id} get data`);
			// call set() in the background to lock the storage mutex
		await call("set", id);

			// get the storage by calling the API directly in this thread, which
			// seems to be slower than doing it in the background, but it's still
			// about 1/3 faster overall because we don't have the overhead of
			// marshalling the data to return it via messaging
		const data = await getAll();
//console.timeEnd(`======= DO TASK ${id} get data`);

		const newData = await task(data);

		return call("done", id, newData)
			.then((newData) => {
//				const taskTime = performance.now() - t;
//				totalTime += taskTime;
//				taskCount++;
//console.log("======= DO TASK", id, "after done", taskTime, "ms", isNewDataDifferent(newData, data), newData);
//console.log(`======= DO TASK ${id} avg time:`, Math.round(totalTime / taskCount), "ms", taskCount, "total");

					// combine the full data with whatever changed in the set()
					// task and update our dataPromise with that
				Object.assign(data, newData);
				dataPromise = Promise.resolve(data);

//console.log("<<<< SET after SAVE", id, storageLocation, data, "\n\n\n");
//console.error("<<<< SET after SAVE", id, storageLocation, data, "\n\n\n");

				return data;
			});
	}


	return {
		get,
		set,
	};
}
