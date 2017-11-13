define([
	"cp",
	"mutex"
], function(
	cp,
	Mutex
) {
	const MaxTabsLength = 50,
		MinDwellTime = 750;


	const storageMutex = new Mutex();


	function save(
		data,
		event)
	{
			// arrays and objects that are updated don't seem to get saved with
			// the updated state, so make copies and store those
		if (data.tabIDs) {
			data.tabIDs = [].concat(data.tabIDs);
		}

		if (data.tabsByID) {
			data.tabsByID = Object.assign({}, data.tabsByID);
		}

console.log("saving", event, data.tabIDs && data.tabIDs.slice(-4).join(","), data);

		return cp.storage.local.set(data)
			.then(function() {
				console.log("SAVED", event);
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


	function reset()
	{
		return storageMutex.synchronize(function() {
			return getDefaultStorage()
				.then(save);
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


	function getRecents()
	{
		return getAll()
			.then(function(storage) {
				return storage.tabIDs.map(function(tabID) {
						return storage.tabsByID[tabID];
					});
			});
	}


	function updateRecents()
	{
		return storageMutex.synchronize(function() {
			return Promise.all([
				cp.tabs.query({}),
				getAll()
			])
				.then(function(result) {
					var newTabs = result[0],
						data = result[1],
						tabIDs = data.tabIDs,
						tabsByID = data.tabsByID,
						newTabsByURL = {};

						// create a dictionary of the new tabs by URL
					newTabs.forEach(function(tab) {
						newTabsByURL[tab.url] = tab;
					});

					tabIDs = tabIDs.map(function(tabID) {
						var oldTab = tabsByID[tabID],
							newTab = newTabsByURL[oldTab && oldTab.url];

						if (newTab) {
								// we found the same URL in a new tab, so copy over
								// the recent timestamp and store it in the hash
								// using the new tab's ID
							newTab.recent = oldTab.recent;
							tabsByID[newTab.id] = newTab;

							return newTab.id;
						} else {
							delete tabsByID[tabID];

							return null;
						}
					})
						.filter(function(tabID) {
								// filter out the IDs for any tabs we didn't find
							return tabID;
						});


					return save({
						tabIDs: tabIDs,
						tabsByID: tabsByID,
						recentsUpdated: Date.now(),
						newTabsCount: newTabs.length
					}, "updateRecents");
				});
		});
	}


	function addTab(
		tab,
		fromFocusChange)
	{
		return storageMutex.synchronize(function() {
			return getAll()
				.then(function(storage) {
					var id = tab.id,
						now = Date.now(),
						tabIDs = storage.tabIDs,
						tabsByID = storage.tabsByID,
						lastID,
						lastTab;

// TODO: if there are only two items, and we're switching back to the previous one,
// we don't want to remove one that's < MinViewTime, because then there won't be
// a record of where to go back to

// TODO: do we need an array?  could just have dictionary and last tab ID
// to generate a list of recent tabs, would have to sort by ts

// TODO: store visits to a tab in an array.  if visit is < MinDwellTime, pop its last visit time
// remove it if the array is empty

					lastID =  tabIDs[tabIDs.length - 1];
					lastTab = tabsByID[lastID];

					if ((lastTab && lastTab.url == tab.url && lastTab.id == tab.id &&
							lastTab.windowId == tab.windowId) || storage.previousTabIndex > -1) {
							// this is the same tab getting refocused, which could
							// happen just from opening the extension and then
							// closing it without doing anything.  or we switched to
							// the tab using the keyboard shortcut.
						return save({ switchFromShortcut: false }, "same tab");
					}

						// make sure the ID isn't currently in the list
					tabIDs = tabIDs.filter(function(item) {
						return item != id;
					});

//					if (!storage.switchFromShortcut && !fromFocusChange && lastTab &&
//							(now - lastTab.recent < MinDwellTime)) {
//							// the previously active tab wasn't active for very long,
//							// so remove it from the list and the dictionary
//console.log("removing", lastID, lastTab.url);
//						delete tabsByID[tabIDs.pop()];
//					}

					tab.recent = now;
					tabIDs.push(id);
					tabsByID[id] = tab;

						// remove any older tabs that are over the max limit
					tabIDs.splice(0, Math.max(tabIDs.length - MaxTabsLength, 0)).forEach(function(id) {
						delete tabsByID[id];
					});

if (storage.switchFromShortcut) {
//	console.log(tabIDs.map(id => tabsByID[id].title).slice(-10).join("\n"));
}

					return save({
						tabIDs: tabIDs,
						tabsByID: tabsByID,
						switchFromShortcut: false
					}, "addTab");
				});
		});
	}


	function removeTab(
		tabID)
	{
		return storageMutex.synchronize(function() {
			return getAll()
				.then(function(storage) {
					var tabIDs = storage.tabIDs,
						tabsByID = storage.tabsByID;

					var index = tabIDs.indexOf(tabID);

					if (index > -1) {
console.log("tab closed", tabID);
						tabIDs.splice(index, 1);
					}

					delete tabsByID[tabID];

					return save({
						tabIDs: tabIDs,
						tabsByID: tabsByID
					}, "removeTab");
				});
		});
	}


	return {
		save: save,
		reset: reset,
		getAll: getAll,
		getRecents: getRecents,
		updateRecents: updateRecents,
		addTab: addTab,
		removeTab: removeTab
	};
});
