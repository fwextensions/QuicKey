define([
	"bluebird",
	"cp",
	"background/quickey-storage",
	"background/page-trackers",
	"popup/data/add-urls"
], function(
	Promise,
	cp,
	storage,
	pageTrackers,
	addURLs
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

		recent.lastVisit = (oldTab && (oldTab.lastVisit ||
			(oldTab.visits && oldTab.visits.length && oldTab.visits.slice(-1)[0]))) || 0;

		return recent;
	}


	function addVisit(
		tab)
	{
		tab.lastVisit = Date.now();
	}


	function updateFromFreshTabs(
		data,
		freshTabs)
	{
DEBUG && console.log("=== updateFromFreshTabs", data, freshTabs);
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
DEBUG && console.log("=== existing tabs", tabIDs.length, Object.keys(tabsByID).length, "fresh", freshTabs.length);

			// create a dictionary of the new tabs by the URL and
			// unsuspendURL, if any, so that a recent that had been
			// saved unsuspended and then was later suspended could
			// match up with the fresh, suspended tab
		freshTabs.forEach(function(tab) {
			addURLs(tab);
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
DEBUG && console.log("=== missing", oldTab.lastVisit, oldTab.url);
			}
		});
DEBUG && console.log("=== newTabIDs", newTabIDs.length);

		newTabsCount[newTabsCount.length - 1].m = missingCount;

		tracker.event("update", "old-recents", tabIDs.length);
		tracker.event("update", "new-tabs", freshTabs.length);
		tracker.event("update", "missing-recents", missingCount);

		var result = {
			tabIDs: newTabIDs,
			tabsByID: newTabsByID,
			newTabsCount: newTabsCount,
			lastUpdateTime: Date.now()
		};
DEBUG && console.log("updateAll result", result);

		return result;
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

DEBUG && console.log("add", tab.id, tab.title.slice(0, 50));

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
DEBUG && console.log("tab closed", tabID, tabsByID[tabID].title);
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
						newData = {
							tabsByID: tabsByID
						},
						tabs;

					if (data.lastStartupTime > data.lastUpdateTime) {
DEBUG && console.log("====== calling updateFromFreshTabs");
						newData = updateFromFreshTabs(data, freshTabs);
						tabsByID = newData.tabsByID;
					}

						// update the fresh tabs with any recent data we have
					tabs = freshTabs.map(function(tab) {
						const oldTab = tabsByID[tab.id],
							newTab = createRecent(tab, oldTab);

						if (oldTab) {
								// point the recent tab at the refreshed tab so
								// that if the tab's URL had changed since the
								// last time the user focused it, we'll store
								// the current URL with the recent data.  that
								// way, when Chrome restarts and we try to match
								// the saved recents against the new tabs, we'll
								// be able to match it by URL.
							tabsByID[tab.id] = newTab;
						}

						return newTab;
					});

						// only show the closed tabs if we also have some recent
						// tabs, so that the user doesn't see just closed tabs on
						// a new install.  have to check for > 1, since even on a
						// new install or after closing a window, the current tab
						// will be in the list, but is then removed from the list
						// in getTabs().
					if (data.tabIDs.length > 1) {
						tabs = tabs.concat(closedTabs.map(function(session) {
							const tabFromSession = session.tab || session.window.tabs[0],
								tab = createRecent(tabFromSession);

								// session lastModified times are in Unix epoch
							tab.lastVisit = session.lastModified * 1000;
							tab.sessionId = tabFromSession.sessionId;

							return tab;
						}));
					}

						// save off the updated recent data.  we don't call
						// storage.set() for getAll() so that the popup doesn't
						// have to wait for the data to get stored before it's
						// returned, to make the recents menu render faster.
					storage.set(function() {
						return newData;
					});

					return tabs;
				});
		});
	}


	function updateAll()
	{
		return storage.set(function(data) {
			return cp.tabs.query({})
				.then(function(freshTabs) {
DEBUG && console.log("=== updateAll");
					return updateFromFreshTabs(data, freshTabs);
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
DEBUG && console.log("toggleTab previousTabIndex", newData.lastShortcutTabID, previousTabIndex, data.tabsByID[newData.lastShortcutTabID ].title);

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


	function printAll()
	{
		cp.storage.local.get(null)
			.then(function(storage) {
				var data = storage.data,
					tabsByID = data.tabsByID;

				data.tabIDs.slice(-20).reverse().forEach(function(tabID) {
					const tab = tabsByID[tabID];

					if (tab) {
						console.log("%c   ", `font-size: 14px; background: url(${tab.favIconUrl}) no-repeat; background-size: contain`, `${tabID}: ${tab.lastVisit}: ${tab.title.slice(0, 100)}`);
					} else {
						console.log("MISSING", tabID);
					}
				});
			});
	}


	return {
		add: add,
		remove: remove,
		getAll: getAll,
		updateAll: updateAll,
		toggleTab: toggleTab,
		printAll: printAll
	};
});
