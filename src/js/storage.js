define([
	"cp",
	"mutex"
], function(
	cp,
	Mutex
) {
	const MaxTabsLength = 50,
		MinDwellTime = 750,
		TabKeysHash = {
			favIconUrl: 1,
			id: 1,
			incognito: 1,
			title: 1,
			url: 1,
			windowId: 1
		},
		TabKeys = Object.keys(TabKeysHash);


	const storageMutex = new Mutex();


	function pluckRelevantKeys(
		tab)
	{
		return TabKeys.reduce(function(obj, key) {
			obj[key] = tab[key]; return obj;
		}, {});
	}


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


	function reset()
	{
		return storageMutex.synchronize(function() {
			return getDefaultStorage()
				.then(save);
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
						tabData,
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

						// copy just the keys we need from the tab object
					tabData = pluckRelevantKeys(tab);
					tabData.recent = now;
					tabIDs.push(id);
					tabsByID[id] = tabData;

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
						tabsByID = storage.tabsByID,
						index = tabIDs.indexOf(tabID);

					if (index > -1) {
console.log("tab closed", tabID);
						tabIDs.splice(index, 1);
						delete tabsByID[tabID];

						return save({
							tabIDs: tabIDs,
							tabsByID: tabsByID
						}, "removeTab");
					}
				});
		});
	}


	function updateTab(
		tabID,
		changeInfo)
	{
		return storageMutex.synchronize(function() {
			return getAll()
				.then(function(data) {
					var tabsByID = data.tabsByID,
						tab = tabsByID[tabID],
						foundRelevantChange = false;

					if (tab) {
						Object.keys(changeInfo).forEach(function(key) {
							if (key in TabKeysHash) {
								foundRelevantChange = true;
console.log("tab updated", tabID, key, changeInfo[key]);
								tab[key] = changeInfo[key];
							}
						});

						if (foundRelevantChange) {
console.log("saving updated tab");
							return save({
								tabsByID: tabsByID
							}, "updateTab");
						}
					}
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
					var freshTabs = result[0],
						data = result[1],
						freshTabsByURL = {},
						tabIDs = data.tabIDs,
						tabsByID = data.tabsByID,
							// start with an empty object so if there are old
							// tabs lying around that aren't listed in tabIDs
							// they'll get dropped
						newTabsByID = {},
						newTabIDs;

						// create a dictionary of the new tabs by URL
					freshTabs.forEach(function(tab) {
						freshTabsByURL[tab.url] = tab;
					});

						// we need to map tabIDs instead of just building a hash
						// and using Object.keys() to get the list because we
						// want to maintain the recency order
					newTabIDs = tabIDs.map(function(tabID) {
						var oldTab = tabsByID[tabID],
							newTab = freshTabsByURL[oldTab && oldTab.url];

						if (newTab) {
								// we found the same URL in a new tab, so copy over
								// the recent timestamp and store it in the hash
								// using the new tab's ID.  also delete the URL
								// from the hash in case there are duplicate tabs
								// pointing at the same URL.
							newTab = pluckRelevantKeys(newTab);
							newTab.recent = oldTab.recent;
							newTabsByID[newTab.id] = newTab;
							delete freshTabsByURL[oldTab.url];

							return newTab.id;
						} else {
							return null;
						}
					})
						.filter(function(tabID) {
								// filter out the IDs for any tabs we didn't find
							return tabID;
						});


					return save({
						tabIDs: newTabIDs,
						tabsByID: newTabsByID,
						recentsUpdated: Date.now(),
// TODO: remove newTabsCount when we've verified this works
						newTabsCount: freshTabs.length
					}, "updateRecents");
				});
		});
	}


	return {
		save: save,
		reset: reset,
		getAll: getAll,
		getRecents: getRecents,
		addTab: addTab,
		removeTab: removeTab,
		updateTab: updateTab,
		updateRecents: updateRecents
	};
});
