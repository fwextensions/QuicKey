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

		var version = latestVersion,
			getDefaultData = typeof defaultDataCreator == "function" ?
				defaultDataCreator : emptyDefaultData,
			dataPromise = getAll();


		function getAll()
		{
				// pass null to get everything in storage
			return cp.storage.local.get(null)
				.then(function(storage) {
						// if latestVersion wasn't passed in to the createStorage()
						// call, default to the version stored in the data to make
						// it easier to do createStorage().get() in the console
					version = version || storage.version;

						// if this is older storage, make sure there's a version.
						// otherwise, we'd save empty data in a brand new install
						// instead of getting the default data.
					if (!storage.data && storage.version == latestVersion) {
						delete storage.version;

							// we have to clear the storage to get rid of the
							// existing top-level keys, then save the existing
							// data and version
						return cp.storage.local.clear()
							.then(function() {
								return saveStorage(storage);
							});
					} else if (!storage.version || storage.version != version) {
							// this is likely a new install, so get the default storage
							// data, then make sure to save it, because the recentTabs
							// handler probably won't return the full set of data. in
							// that case, the default storage would never get saved,
							// so we'd get the default storage on every call.
						return getDefaultData().then(saveStorage);
					} else {
						return storage.data;
					}
				});
		}


		function saveStorage(
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


		function doTask(
			task,
			saveResult,
			event)
		{
			return storageMutex.lock(function() {
				return dataPromise
					.then(function(data) {
						return Promise.resolve(task(data))
							.then(function(newData) {
								if (newData && saveResult) {
										// update the promised data from storage
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
			task,
			event)
		{
			return doTask(task, true, event);
		}


		function get(
			task,
			event)
		{
			return doTask(task, false, event);
		}


		function reset()
		{
			return storageMutex.lock(function() {
				return getDefaultData()
					.then(saveStorage);
			});
		}


		return {
			get: get,
			set: set,
			reset: reset
		};
	}
});
