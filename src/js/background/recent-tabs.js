define([
	"bluebird",
	"cp",
	"background/storage",
	"background/page-trackers",
	"popup/data/add-urls"
], function(
	Promise,
	cp,
	createStorage,
	pageTrackers,
	addURL
) {
	const MaxTabsLength = 50,
		MaxSwitchDelay = 750,
		TabKeysHash = {
			favIconUrl: 1,
			id: 1,
			incognito: 1,
			title: 1,
			url: 1,
			index: 1,
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
		},
		StorageVersion = 2;


	var shortcutTimer = null,
		storage = createStorage(StorageVersion,
			function() {
				return cp.tabs.query({ active: true, currentWindow: true, windowType: "normal" })
					.then(function(tabs) {
						var data = {
								tabIDs: [],
								tabsByID: {},
								previousTabIndex: -1,
								switchFromShortcut: false,
								lastShortcutTime: 0,
								newTabsCount: []
							},
							tab = tabs && tabs[0];

						if (tab) {
							data.tabIDs.push(tab.id);
							data.tabsByID[tab.id] = tab;
						}

						return data;
					});
			}
		);


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


	function last(
		array)
	{
		return array[array.length - 1];
	}


	function createRecent(
		tab,
		oldTab)
	{
		var recent = TabKeys.reduce(function(obj, key) {
				obj[key] = tab[key];

				return obj;
			}, {});

		recent.lastVisit = (oldTab && (oldTab.lastVisit ||
			(oldTab.visits && oldTab.visits.length && oldTab.visits.slice(-1)[0]))) || 0;

		return recent;
	}


	function addVisit(
		tab)
	{
		tab.lastVisit = Date.now();
	}


	function updateDataFromShortcut()
	{
		return storage.set(function(data) {
			const lastShortcutTabID = data.lastShortcutTabID,
				lastShortcutTab = data.tabsByID[lastShortcutTabID];

			if (!isNaN(lastShortcutTabID) && lastShortcutTab) {
				removeItem(data.tabIDs, lastShortcutTabID);
				data.tabIDs.push(lastShortcutTabID);
				addVisit(lastShortcutTab)
			}

			data.lastShortcutTabID = null;

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
		tab)
	{
		if (!tab) {
			return;
		}

		return storage.set(function(data) {
			var id = tab.id,
				tabIDs = data.tabIDs,
				tabsByID = data.tabsByID,
				tabData,
				lastID,
				lastTab;

			if (data.switchFromShortcut) {
				return { switchFromShortcut: false };
			}

			lastID = last(tabIDs);
			lastTab = tabsByID[lastID];

			if ((lastTab && lastTab.url == tab.url && lastTab.id == tab.id &&
					lastTab.windowId == tab.windowId)) {
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

console.log("add", tab.id, tab.title.slice(0, 50));

				// make sure the new tab's ID isn't currently in the list and
				// then push it on the end
			removeItem(tabIDs, id);
			tabIDs.push(id);

				// copy just the keys we need from the tab object
			tabData = createRecent(tab, tabsByID[id]);
			addVisit(tabData);
			tabsByID[id] = tabData;

				// remove any older tabs that are over the max limit
			tabIDs.splice(0, Math.max(tabIDs.length - MaxTabsLength, 0)).forEach(function(id) {
				delete tabsByID[id];
			});

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
		if (isNaN(tabID)) {
			return;
		}

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
			return Promise.all([
					cp.tabs.query({}),
					cp.sessions.getRecentlyClosed()
				])
				.spread(function(freshTabs, closedTabs) {
					var tabsByID = data.tabsByID,
						tabs;

						// update the fresh tabs with any recent data we have
					tabs = freshTabs.map(function(tab) {
						return createRecent(tab, tabsByID[tab.id]);
					});

					closedTabs = closedTabs.map(function(session) {
						const tabFromSession = session.tab || session.window.tabs[0],
							tab = createRecent(tabFromSession);

							// session lastModified times are in Unix epoch
						tab.lastVisit = session.lastModified * 1000;
						tab.sessionId = tabFromSession.sessionId;

						return tab;
					});

						// only show the closed tabs if we also have some recent
						// tabs, so that the user doesn't see just closed tabs on
						// a new install.  have to check for > 1, since even on a
						// new install or after closing a window, the current tab
						// will be in the list, which is then removed from the list.
					if (data.tabIDs.length > 1) {
						tabs = tabs.concat(closedTabs);
					}

					return tabs;
				});
		});
	}


	function updateAll()
	{
		return storage.set(function(data) {
			return cp.tabs.query({})
				.then(function(freshTabs) {
console.log("=== updateAll", data, freshTabs);
					var freshTabsByURL = {},
						tabIDs = data.tabIDs,
						tabsByID = data.tabsByID,
							// start with an empty object so if there are old
							// tabs lying around that aren't listed in tabIDs
							// they'll get dropped
						newTabsByID = {},
						newTabIDs = [],
						newTabsCount = [].concat(data.newTabsCount,
							{ l: freshTabs.length, d: Date.now() }).slice(-5),
						missingCount = 0,
						tracker = pageTrackers.background;
console.log("=== existing tabs", tabIDs.length, Object.keys(tabsByID).length, "fresh", freshTabs.length);

						// create a dictionary of the new tabs by the URL and
						// unsuspendURL, if any, so that a recent that had been
						// saved unsuspended and then was later suspended could
						// match up with the fresh, suspended tab
					freshTabs.forEach(function(tab) {
						addURL(tab);
						freshTabsByURL[tab.url] = tab;
						tab.unsuspendURL && (freshTabsByURL[tab.unsuspendURL] = tab);
					});

						// we need to loop on tabIDs instead of just building a
						// hash and using Object.keys() to get a new list because
						// we want to maintain the recency order from tabIDs
					tabIDs.forEach(function(tabID) {
						var oldTab = tabsByID[tabID],
							newTab = freshTabsByURL[oldTab && oldTab.url];

						if (newTab) {
								// we found the same URL in a new tab, so copy over
								// the relevant keys and store it in the hash
								// using the new tab's ID.  also delete the URL
								// from the hash in case there are duplicate tabs
								// pointing at the same URL.
							newTab = createRecent(newTab, oldTab);
							newTabsByID[newTab.id] = newTab;
							newTabIDs.push(newTab.id);
							delete freshTabsByURL[oldTab.url];
						} else {
							missingCount++;
console.log("=== missing", oldTab.lastVisit, oldTab.url);
						}
					});
console.log("=== newTabIDs", newTabIDs.length);

					tracker.event("update", "old-recents", tabIDs.length);
					tracker.event("update", "new-tabs", freshTabs.length);
					tracker.event("update", "missing-recents", missingCount);

					var result = {
						tabIDs: newTabIDs,
						tabsByID: newTabsByID,
						newTabsCount: newTabsCount
					};
console.log("updateAll result", result);

					return result;

//					return {
//						tabIDs: newTabIDs,
//						tabsByID: newTabsByID,
//// TODO: remove newTabsCount when we've verified this works
//						newTabsCount: newTabsCount
//					};
				});
		}, "updateAll");
	}


	function toggleTab(
		direction,
		fromDoublePress)
	{
		return storage.set(function(data) {
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
					// set the tab index assuming this toggle isn't happening
					// during the 750ms window since the last shortcut fired.  if
					// the user is going forward, don't let them go past the most
					// recently used tab.
				previousTabIndex = (direction == -1) ?
					(maxIndex + direction + tabIDCount) % tabIDCount :
					maxIndex;

			if (tabIDCount > 1) {
				if (tabIDCount > 2 && !isNaN(data.lastShortcutTime) &&
						now - data.lastShortcutTime < MaxSwitchDelay) {
					if (data.previousTabIndex > -1) {
						if (direction == -1) {
								// when going backwards, wrap around if necessary
							previousTabIndex = (data.previousTabIndex - 1 + tabIDCount) % tabIDCount;
						} else {
								// don't let the user go past the most recently
								// used tab
							previousTabIndex = Math.min(data.previousTabIndex + 1, maxIndex);
						}
					}
				}

				newData.previousTabIndex = previousTabIndex;
				newData.lastShortcutTabID = tabIDs[previousTabIndex];
console.log("toggleTab previousTabIndex", newData.lastShortcutTabID, previousTabIndex, data.tabsByID[newData.lastShortcutTabID ].title);

				if (previousTabIndex > -1 && newData.lastShortcutTabID) {
					var previousTabID = newData.lastShortcutTabID,
						previousWindowID = data.tabsByID[previousTabID].windowId;

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
			}

			return newData;
		}, "toggleTab");
	}


	return {
		add: add,
		remove: remove,
		getAll: getAll,
		updateAll: updateAll,
		toggleTab: toggleTab
	};
});
