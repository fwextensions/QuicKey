define([
	"bluebird",
	"cp",
	"background/mutex"
], function(
	Promise,
	cp,
	Mutex
) {
	function emptyDefaultData()
	{
		return Promise.resolve({});
	}


	return function createStorage(
		latestVersion,
		defaultDataCreator)
	{
		const storageMutex = new Mutex(Promise);

		var version = latestVersion || 1,
			getDefaultData = typeof defaultDataCreator == "function" ?
				defaultDataCreator : emptyDefaultData,
			dataPromise = getAll();


		function getAll()
		{
				// pass null to get everything in storage
			return cp.storage.local.get(null)
				.then(function(storage) {
					if (storage.version !== version) {
							// this is likely a new install, so reset the storage
							// to the default.  we need to do this without locking
							// the mutex because doTask() locks it and then calls
							// this promise, so if we called the locking reset
							// from here, it would never complete.
						return resetWithoutLocking();
					} else {
						return storage.data;
					}
				});
		}


		function saveWithVersion(
			data)
		{
			return cp.storage.local.set({
				version: version,
				data: data
			})
				.return(data);
		}


		function save(
			data)
		{
			return cp.storage.local.set({ data: data })
				.return(data);
		}


		function resetWithoutLocking()
		{
			return cp.storage.local.clear()
				.then(getDefaultData)
				.then(saveWithVersion)
				.then(function(data) {
						// normally, dataPromise points to the resolved
						// promise from getAll() that was created when
						// createStorage() was first called and returns the
						// in-memory version of the data object from storage.
						// but since we just cleared that, we need to update
						// the promise to point to the fresh data in memory.
					return dataPromise = Promise.resolve(data);
				});
		}


		function doTask(
			task,
			saveResult)
		{
			return storageMutex.lock(function() {
				return dataPromise
					.then(function(data) {
						return Promise.resolve(task(data))
							.then(function(newData) {
								if (newData && saveResult) {
										// since all the values are stored on the
										// .data key of the storage instead of at
										// the topmost level, we need to update
										// that object with the changed data
										// before calling save().  otherwise, we'd
										// lose any values that weren't changed
										// and returned by the task function.
									Object.assign(data, newData);

									return save(data);
								} else {
									return newData;
								}
							});
					});
			});
		}


		function set(
			task)
		{
			return doTask(task, true);
		}


		function get(
			task)
		{
			return doTask(task, false);
		}


		function reset()
		{
			return storageMutex.lock(resetWithoutLocking);
		}


		return {
			get: get,
			set: set,
			reset: reset
		};
	}
});
