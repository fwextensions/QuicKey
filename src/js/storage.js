define([
	"cp",
	"mutex"
], function(
	cp,
	Mutex
) {
	const storageMutex = new Mutex();


	function doTask(
		task,
		saveResult,
		event)
	{
		return storageMutex.lock(function() {
			return getAll()
				.then(task)
				.then(function(data) {
					if (data && saveResult) {
						return save(data, event);
					} else {
						return Promise.resolve(data);
					}
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


	function save(
		data,
		event)
	{
console.log("saving", event, data.tabIDs && data.tabIDs.slice(-4).join(", "), data);

		return cp.storage.local.set(data)
			.then(function() {
//console.log("SAVED", event);
				return data;
			});
	}


	function getDefaultStorage()
	{
		return cp.tabs.query({ active: true, currentWindow: true, windowType: "normal" })
			.then(function(tabs) {
				var storage = {
						version: 1,
						tabIDs: [],
						tabsByID: {},
						previousTabIndex: -1,
						switchFromShortcut: false,
						lastShortcutTime: 0
					},
					tab = tabs && tabs[0];

				if (tab) {
					storage.tabIDs.push(tab.id);
					storage.tabsByID[tab.id] = tab;
				}

				return storage;
			});
	}


	function getAll()
	{
			// pass null to get everything in storage
		return cp.storage.local.get(null)
			.then(function(storage) {
				if (!storage) {
					return getDefaultStorage();
				} else {
					return storage;
				}
			});
	}


	function reset()
	{
		return storageMutex.lock(function() {
			return getDefaultStorage()
				.then(save);
		});
	}


	return {
		get: get,
		set: set,
		reset: reset
	};
});
