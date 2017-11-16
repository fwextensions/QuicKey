define([
	"storage",
	"cp"
], function(
	storage,
	cp
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


	function pluckRelevantKeys(
		tab)
	{
		return TabKeys.reduce(function(obj, key) {
			obj[key] = tab[key]; return obj;
		}, {});
	}


	function add(
		tab,
		fromFocusChange)
	{
		return storage.set(function(data) {
			var id = tab.id,
				now = Date.now(),
				tabIDs = data.tabIDs,
				tabsByID = data.tabsByID,
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

console.log("add", tab.title);

			lastID =  tabIDs[tabIDs.length - 1];
			lastTab = tabsByID[lastID];

			if ((lastTab && lastTab.url == tab.url && lastTab.id == tab.id &&
					lastTab.windowId == tab.windowId)) {
//							lastTab.windowId == tab.windowId) || storage.previousTabIndex > -1) {
					// this is the same tab getting refocused, which could
					// happen just from opening the extension and then
					// closing it without doing anything.  or we switched to
					// the tab using the keyboard shortcut.
				return { switchFromShortcut: false };
			}

				// make sure the ID isn't currently in the list
			tabIDs = tabIDs.filter(function(item) {
				return item != id;
			});

//					if (!data.switchFromShortcut && !fromFocusChange && lastTab &&
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

if (data.switchFromShortcut) {
//	console.log(tabIDs.map(id => tabsByID[id].title).slice(-10).join("\n"));
}

			return {
				tabIDs: tabIDs,
				tabsByID: tabsByID,
				switchFromShortcut: false
			};
		}, "addTab");
	}


	function remove(
		tabID)
	{
		return storage.set(function(data) {
			var tabIDs = data.tabIDs,
				tabsByID = data.tabsByID,
				index = tabIDs.indexOf(tabID);

			if (index > -1) {
console.log("tab closed", tabID, tabsByID[tabID].title);
				tabIDs.splice(index, 1);
				delete tabsByID[tabID];

				return {
					tabIDs: tabIDs,
					tabsByID: tabsByID
				};
			}
		}, "removeTab");
	}


	function getAll()
	{
		return storage.get(function(data) {
			var recents = data.tabIDs.map(function(tabID) {
					return data.tabsByID[tabID];
				});

			recents.tabsByID = data.tabsByID;

			return recents;
		});
	}


	function update(
		tabID,
		changeInfo)
	{
		return storage.set(function(data) {
			var tabsByID = data.tabsByID,
				tab = tabsByID[tabID],
				updateCount = data.updateCount,
				foundRelevantChange = false;

			if (tab) {
				Object.keys(changeInfo).forEach(function(key) {
					if (key in TabKeysHash) {
						foundRelevantChange = true;
console.log("tab updated", tabID, key, changeInfo[key], tab.title);
						tab[key] = changeInfo[key];
					}
				});

				if (foundRelevantChange) {
console.log("saving updated tab");
					return {
						tabsByID: tabsByID,
						updateCount: (updateCount || 0) + 1
					};
				}
			}
		}, "updateTab");
	}


	function updateAll()
	{
		return storage.set(function(data) {
			return cp.tabs.query({})
				.then(function(freshTabs) {
					var freshTabsByURL = {},
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
						// want to maintain the recency order from tabIDs
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

					return {
						tabIDs: newTabIDs,
						tabsByID: newTabsByID,
						recentsUpdated: Date.now(),
// TODO: remove newTabsCount when we've verified this works
						newTabsCount: freshTabs.length
					};
				}, "updateRecents");
		});
	}


	return {
		add: add,
		remove: remove,
		getAll: getAll,
		update: update,
		updateAll: updateAll
	};
});
