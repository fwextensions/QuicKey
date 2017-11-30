define([
	"storage",
	"cp"
], function(
	storage,
	cp
) {
	const MaxTabsLength = 50,
		MaxSwitchDelay = 750,
		MinDwellTime = 750,
		TabKeysHash = {
			favIconUrl: 1,
			id: 1,
			incognito: 1,
			title: 1,
			url: 1,
			windowId: 1
		},
		TabKeys = Object.keys(TabKeysHash),
		IconPaths = {
			path: {
				"19": "img/icon-19.png",
				"38": "img/icon-38.png"
			}
		},
		InvertedIconPaths = {
			path: {
				"19": "img/icon-19-inverted.png",
				"38": "img/icon-38-inverted.png"
			}
		};


	var shortcutTimer = null;


	function pluckRelevantKeys(
		tab)
	{
		return TabKeys.reduce(function(obj, key) {
			obj[key] = tab[key];

			return obj;
		}, {});
	}


	function removeItem(
		array,
		item)
	{
		var index = array.indexOf(item);

		if (index > -1) {
			array.splice(index, 1);
		}

		return array;
	}


	function updateDataFromShortcut()
	{
		return storage.set(function(data) {
			const lastShortcutTabID = data.lastShortcutTabID;

			if (lastShortcutTabID) {
				removeItem(data.tabIDs, lastShortcutTabID);
				data.tabIDs.push(lastShortcutTabID);
				data.tabsByID[lastShortcutTabID].recent = Date.now();
				data.lastShortcutTabID = null;
			}

			return data;
		}, "updateDataFromShortcut");
	}


	function startShortcutTimer()
	{
		chrome.browserAction.setIcon(InvertedIconPaths);
		clearTimeout(shortcutTimer);
		shortcutTimer = setTimeout(onShortcutTimerDone, MaxSwitchDelay);
	}


	function onShortcutTimerDone()
	{
		chrome.browserAction.setIcon(IconPaths);

		return updateDataFromShortcut();
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

// TODO: if this came from switchFromShortcut, then need to ignore this now
// 	and start a timer to update tabIDs in a second

console.log("add", tab.id, tab.title);

			if (data.switchFromShortcut) {
				return { switchFromShortcut: false };
			}

			lastID =  tabIDs[tabIDs.length - 1];
			lastTab = tabsByID[lastID];

			if ((lastTab && lastTab.url == tab.url && lastTab.id == tab.id &&
					lastTab.windowId == tab.windowId)) {
//							lastTab.windowId == tab.windowId) || storage.previousTabIndex > -1) {
					// this is the same tab getting refocused, which could
					// happen just from opening the extension and then
					// closing it without doing anything.  or we switched to
					// the tab using the keyboard shortcut.
// TODO: do we need to save lastShortcutTabID here?  might be faster not to
				return {
					switchFromShortcut: false,
					lastShortcutTabID: null
				};
			}

				// make sure the ID isn't currently in the list
			removeItem(tabIDs, id);


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
				switchFromShortcut: false,
				lastShortcutTabID: null
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
			return cp.tabs.query({})
				.then(function(freshTabs) {
					var freshTabsByID = {},
						tabIDs = data.tabIDs,
						tabsByID = data.tabsByID,
						newTabsByID = {},
						recents = [];

						// create a dictionary of the new tabs by ID
					freshTabs.forEach(function(tab) {
						freshTabsByID[tab.id] = tab;
					});

					tabIDs.forEach(function(tabID) {
						var oldTab = tabsByID[tabID],
							newTab = freshTabsByID[oldTab && oldTab.id];

						if (newTab) {
							newTab = pluckRelevantKeys(newTab);
							newTab.recent = oldTab.recent;
							newTabsByID[newTab.id] = newTab;
							recents.push(newTab);
						}
					});

					recents.tabsByID = tabsByID;

// TODO: return all the tabs along with recents from this, so app.js doesn't have to also get all tabs
// TODO: do we need to save the data with the newly pushed lastShortcutTabID?
//			updateDataFromShortcut(data);

					return recents;
				});
		});
	}


	function update(
		tabID,
		changeInfo)
	{
		var newData = {},
			foundRelevantChange = false;

		Object.keys(changeInfo).forEach(function(key) {
			if (key in TabKeysHash) {
				foundRelevantChange = true;
				newData[key] = changeInfo[key];
console.log("tab updated", tabID, key, changeInfo[key]);
			}
		});

			// we only want to call storage.set() if we actually found something,
			// since onUpdated gets called a lot and getting and setting the
			// storage is a bit costly
		if (foundRelevantChange) {
			return storage.set(function(data) {
				var tabsByID = data.tabsByID,
					tab = tabsByID[tabID];

				if (tab) {
					Object.assign(tab, newData);
				}

				return {
					tabsByID: tabsByID
				};
			}, "updateTab");
		}

	}


	function toggleTab(
		direction,
		fromDoublePress)
	{
		storage.set(function(data) {
			var tabIDs = data.tabIDs,
				tabIDCount = tabIDs.length,
				maxIndex = tabIDCount - 1,
				now = Date.now(),
					// set a flag so we know when the previous tab is re-activated
					// that it was caused by us, not the user, so that it doesn't
					// remove tabs based on dwell time.  but only do that if the
					// user is toggling the tab via the previous/next-tab shortcut
					// and not by double-pressing the popup shortcut.  use 0 as
					// the lastShortcutTime in that case so if the user quickly
					// does the double-press twice, it will just toggle instead
					// of pushing further back in the stack.
				newData = {
					switchFromShortcut: !fromDoublePress,
					lastShortcutTime: fromDoublePress ? 0 : now,
					previousTabIndex: -1
				},
				previousTabIndex = (maxIndex + direction + tabIDCount) % tabIDCount;

			if (tabIDCount > 1) {
//console.log("==== switch time", now - data.lastShortcutTime, tabIDCount > 2, !isNaN(data.lastShortcutTime),
//						now - data.lastShortcutTime < MaxSwitchDelay );

				if (tabIDCount > 2 && !isNaN(data.lastShortcutTime) &&
						now - data.lastShortcutTime < MaxSwitchDelay) {
					if (data.previousTabIndex > -1) {
						previousTabIndex = (data.previousTabIndex + direction + tabIDCount) % tabIDCount;
					}
console.log("==== previous", previousTabIndex);
				}

				newData.previousTabIndex = previousTabIndex;
				newData.lastShortcutTabID = data.tabIDs[previousTabIndex];
console.log("toggleTab previousTabIndex", newData.lastShortcutTabID, previousTabIndex, data.tabsByID[newData.lastShortcutTabID ].title);

				Object.assign(data, newData);

// TODO: always return data to force prev index to -1 if there aren't enough tabs?
				return data;
			}
		}, "toggleTab")
			.then(function(data) {
				if (data && data.previousTabIndex > -1 && data.lastShortcutTabID) {
					var previousTabID = data.lastShortcutTabID,
						previousWindowID = data.tabsByID[previousTabID].windowId;
console.log("toggleTab then previousTabID", previousTabID, data.previousTabIndex);

						// we only want to start the timer if the user triggered
						// us with the previous/next-tab shortcut, not double-
						// pressing the popup shortcut, so that the tab activation
						// will immediately reorder the tabIDs array in add() above
					if (!fromDoublePress) {
						startShortcutTimer();
					}

					chrome.tabs.update(previousTabID, { active: true });

					if (previousWindowID != chrome.windows.WINDOW_ID_CURRENT) {
						chrome.windows.update(previousWindowID, { focused: true });
					}
				}
			});
	}


	return {
		add: add,
		remove: remove,
		getAll: getAll,
		update: update,
		toggleTab: toggleTab
	};
});
