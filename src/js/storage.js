define([
	"cp"
], function(
	cp
) {
	const MaxTabsLength = 20;


	function getAll()
	{
			// pass null to get everything in storage
		return cp.storage.local.get(null)
			.then(function(storage) {
				if (!storage || !storage.tabIDs) {
					return {
						tabIDs: [],
						tabsByID: {}
					};
				} else {
					return storage;
				}
			});
	}


	function addTab(
		tab)
	{
		return getAll()
			.then(function(storage) {
				var id = tab.id,
					tabInfo = {
						id: id,
						windowID: tab.windowId,
						url: tab.url,
						ts: Date.now()
					},
					tabIDs = storage.tabIDs,
					tabsByID = storage.tabsByID;

// TODO: remove the last entry if the new tab's timestamp is < 1000ms within the previous one

					// make sure the ID isn't currently in the list and then add it
				tabIDs = tabIDs.filter(function(item) {
					return item != id;
				}).concat(id);

					// remove any older tabs that are over the max limit
				tabIDs.splice(0, Math.max(tabIDs.length - MaxTabsLength, 0)).forEach(function(id) {
					delete tabsByID[id];
				});
				tabsByID[id] = tabInfo;

				storage = {
					tabIDs: tabIDs,
					tabsByID: tabsByID
				};

				chrome.storage.local.set(storage);
			});
	}


	return {
		getAll: getAll,
		addTab: addTab
	};
});
