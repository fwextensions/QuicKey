define([
	"cp",
	"mutex"
], function(
	cp,
	Mutex
) {
	const storageMutex = new Mutex();


	function save(
		data,
		event)
	{
// TODO: check if this duplication is still needed.  saving may have been failing because there was no mutex
			// arrays and objects that are updated don't seem to get saved with
			// the updated state, so make copies and store those
		for (var key in data) {
			var value = data[key];

			if (value instanceof Array) {
				data[key] = [].concat(value);
			} else if (value && typeof value == "object") {
				data[key] = Object.assign({}, value);
			}
		}

console.log("saving", event, data.tabIDs && data.tabIDs.slice(-4).join(","), data);

		return cp.storage.local.set(data)
			.then(function() {
console.log("SAVED", event);
				return data;
			});
	}


	function doTask(
		task,
		saveResult,
		event)
	{
		return storageMutex.synchronize(function() {
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
		return storageMutex.synchronize(function() {
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
