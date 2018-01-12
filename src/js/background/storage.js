define([
	"cp",
	"background/mutex"
], function(
	cp,
	Mutex
) {
	function emptyDefaultData()
	{
		return Promise.resolve({});
	}


	return function createStorage(
		latestVersion,
		defaultDataPromise)
	{
		const storageMutex = new Mutex();

		var version = latestVersion,
			getDefaultData = typeof defaultDataPromise == "function" ?
				defaultDataPromise : emptyDefaultData,
			dataPromise = getAll();


		function getAll()
		{
				// pass null to get everything in storage
			return cp.storage.local.get(null)
				.then(function(data) {
						// if latestVersion wasn't passed in to the createStorage()
						// call, default to the version stored in the data to make
						// it easier to do createStorage().get() in the console
					version = version || data.version;

					if (!data.version || data.version != version) {
							// this is likely a new install, so get the default storage
							// data, then make sure to save it, because the recentTabs
							// handler probably won't return the full set of data. in
							// that case, the default storage would never get saved,
							// so we'd get the default storage on every call.
						return getDefaultData().then(save);
					} else {
						return data;
					}
				});
		}


		function save(
			data,
			event)
		{
			return cp.storage.local.set(data)
				.then(function() {
//console.log("SAVED", event, data);
						// local.set() doesn't return the data, so we need a then
						// to return it
					return data;
				});
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

									return save(data, event);
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
					.then(save);
			});
		}


		return {
			get: get,
			set: set,
			reset: reset
		};
	}
});
