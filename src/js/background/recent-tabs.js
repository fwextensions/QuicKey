define([
	"cp",
	"background/storage"
], function(
	cp,
	storage
) {
	const MaxTabsLength = 50,
		MaxSwitchDelay = 750,
		MinDwellTime = 750,
		MaxVisitCount = 3,
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
		};


	var shortcutTimer = null;


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

		recent.visits = (oldTab && oldTab.visits) || [];

		return recent;
	}


	function addVisit(
		tab)
	{
		tab.visits.push(Date.now());
		tab.visits = tab.visits.slice(-MaxVisitCount);
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
		tab,
		fromFocusChange)
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
				lastTab,
				lastTabVisit;

console.log("add", tab.id, tab.title);

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

			if (!fromFocusChange && lastTab && tabIDs.length > 2 &&
					(Date.now() - last(lastTab.visits) < MinDwellTime)) {
					// the previously active tab wasn't active for very long,
					// so remove its last visit time
				lastTab.visits.pop();
				tabIDs.pop();

				if (!lastTab.visits.length) {
						// this tab doesn't have any recent visits, so forget it
					delete tabsByID[lastID];
				} else {
						// reinsert the tab based on its previous visit time
					lastTabVisit = last(lastTab.visits);

					for (var i = tabIDs.length - 1; i >= 0; i--) {
						if (lastTabVisit > last(tabsByID[tabIDs[i]].visits)) {
							tabIDs.splice(i + 1, 0, lastID);
							break;
						}
					}

					if (i == 0 && tabIDs[0] != lastID) {
							// stick lastTab at the beginning of the array if
							// its last visit is older than all the other tabs
						tabIDs.splice(0, 0, lastID);
					}
				}
			}

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
				.then(function(results) {
					var freshTabs = results[0],
 						closedTabs = results[1],
						tabsByID = data.tabsByID,
						tabs;

						// update the fresh tabs with any recent data we have
					tabs = freshTabs.map(function(tab) {
						return createRecent(tab, tabsByID[tab.id]);
					});

					closedTabs = closedTabs.map(function(session) {
						const tabFromSession = session.tab || session.window.tabs[0],
							tab = createRecent(tabFromSession);

							// session lastModified times are in Unix epoch
						tab.visits = [session.lastModified * 1000];
						tab.sessionId = tabFromSession.sessionId;

						return tab;
					});

						// only show the closed tabs if we also have some recent
						// tabs, so that the user doesn't see just closed tabs
						// on a new install
					if (data.tabIDs.length) {
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
					var freshTabsByURL = {},
						tabIDs = data.tabIDs,
						tabsByID = data.tabsByID,
							// start with an empty object so if there are old
							// tabs lying around that aren't listed in tabIDs
							// they'll get dropped
						newTabsByID = {},
						newTabIDs = [],
						newTabsCount = [].concat(data.newTabsCount,
							{ l: freshTabs.length, d: Date.now() }).slice(-5);

						// create a dictionary of the new tabs by URL
					freshTabs.forEach(function(tab) {
						freshTabsByURL[tab.url] = tab;
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
						}
					});

					return {
						tabIDs: newTabIDs,
						tabsByID: newTabsByID,
// TODO: remove newTabsCount when we've verified this works
						newTabsCount: newTabsCount
					};
				});
		}, "updateAll");
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
							previousTabIndex = (data.previousTabIndex - 1 + tabIDCount) % tabIDCount;
						} else {
								// don't let the user go past the most recently
								// used tab
							previousTabIndex = Math.min(data.previousTabIndex + 1, maxIndex);
						}
					}
//console.log("==== previous", previousTabIndex);
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
//console.log("toggleTab then previousTabID", previousTabID, data.previousTabIndex);

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
		updateAll: updateAll,
		toggleTab: toggleTab
	};
});
