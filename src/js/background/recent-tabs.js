define([
	"bluebird",
	"cp",
	"shared",
	"popup/data/add-urls",
	"./quickey-storage",
	"./page-trackers",
	"./constants",
], function(
	Promise,
	cp,
	shared,
	addURLs,
	storage,
	pageTrackers,
	k
) {
	const MaxTabsLength = 50,
		MaxSwitchDelay = 750,
		TabKeysHash = {
			id: 1,
			url: 1,
			windowId: 1
		},
		TabKeys = Object.keys(TabKeysHash);


	function titleOrURL(
		tab,
		length)
	{
		if (!tab) {
			return "NO TAB";
		} else {
			return (tab.title || tab.url).slice(0, length || 75);
		}
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

		recent.lastVisit = (oldTab && oldTab.lastVisit) || 0;

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
DEBUG && console.log("=== missing", tabID, oldTab && oldTab.lastVisit, oldTab && oldTab.url);
			}
		});
DEBUG && console.log("=== newTabIDs", newTabIDs.length);

			// use timing() instead of event() so that we can get a histogram in
			// GA of the different values, which is hard with events
		tracker.timing("update", "old-recents", tabIDs.length);
		tracker.timing("update", "new-tabs", freshTabs.length);
		tracker.timing("update", "missing-recents", missingCount);

		var result = {
			tabIDs: newTabIDs,
			tabsByID: newTabsByID,
			lastUpdateTime: Date.now()
		};
DEBUG && console.log("updateFromFreshTabs result", result);

		return result;
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

			lastID = last(tabIDs);
			lastTab = tabsByID[lastID];

			if ((lastTab && lastTab.url == tab.url && lastTab.id == tab.id &&
					lastTab.windowId == tab.windowId)) {
					// this is the same tab getting refocused, which could
					// happen just from opening the extension and then
					// closing it without doing anything.  or we switched to
					// the tab using the keyboard shortcut.
				return;
			}

DEBUG && console.log("add", tab.id, titleOrURL(tab));

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
				tabsByID: tabsByID
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
DEBUG && console.log("tab closed", tabID, titleOrURL(tabsByID[tabID]));
				tabIDs.splice(index, 1);
				delete tabsByID[tabID];

				return {
					tabIDs: tabIDs,
					tabsByID: tabsByID
				};
			}
		}, "removeTab");
	}


	function replace(
		oldID,
		newID)
	{
		return storage.set(function(data) {
			var tabIDs = data.tabIDs,
				tabsByID = data.tabsByID,
				index = tabIDs.indexOf(oldID),
				oldTab = tabsByID[oldID],
				newData = {};

			if (oldTab) {
					// delete the tab from tabsByID even if it's not in tabIDs
				delete tabsByID[oldID];
				newData.tabsByID = tabsByID;
			}

			if (index > -1) {
DEBUG && console.log("tab replaced", oldID, titleOrURL(oldTab));
				tabIDs[index] = newID;
				tabsByID[newID] = oldTab;
				tabsByID[newID].id = newID;

				newData.tabIDs = tabIDs;
				newData.tabsByID = tabsByID;
			}

			return newData;
		}, "replaceTab");
	}


	function getAll()
	{
		return storage.get(function(data) {
			const promises = [cp.tabs.query({})];

			if (data.settings[k.IncludeClosedTabs.Key]) {
				promises.push(cp.sessions.getRecentlyClosed());
			} else {
				promises.push([]);
			}

			return Promise.all(promises)
				.spread(function(freshTabs, closedTabs) {
					const freshTabsByURL = {};
					const closedTabsByURL = {};
					var tabsByID = data.tabsByID;
					var newData = {
						tabsByID: tabsByID
					};
					var tabs;

						// lastUpdateTime shouldn't be undefined, but just in case
					if (isNaN(data.lastUpdateTime) ||
							data.lastStartupTime > data.lastUpdateTime) {
DEBUG && console.log("====== calling updateFromFreshTabs");

						newData = updateFromFreshTabs(data, freshTabs);
						tabsByID = newData.tabsByID;
					}

						// update the fresh tabs with any recent data we have
					tabs = freshTabs.map(function(tab) {
						const oldTab = tabsByID[tab.id];
						var lastVisit = 0;

						if (oldTab) {
								// point the recent tab at the refreshed tab so
								// that if the tab's URL had changed since the
								// last time the user focused it, we'll store
								// the current URL with the recent data.  that
								// way, when Chrome restarts and we try to match
								// the saved recents against the new tabs, we'll
								// be able to match it by URL.
							tabsByID[tab.id] = createRecent(tab, oldTab);
							lastVisit = tabsByID[tab.id].lastVisit;
						}

						tab.lastVisit = lastVisit;
						freshTabsByURL[tab.url] = true;

						return tab;
					});

						// only show the closed tabs if we also have some recent
						// tabs, so that the user doesn't see just closed tabs on
						// a new install.  have to check for > 1, since even on a
						// new install or after closing a window, the current tab
						// will be in the list, but is then removed from the list
						// in getTabs().
					if (data.tabIDs.length > 1) {
							// convert the sessions to tab objects and dedupe
							// them by URL, keeping the most recent version of each
						tabs = tabs.concat(closedTabs.map(function(session) {
								const tabFromSession = session.tab || session.window.tabs[0];

									// session lastModified times are in Unix epoch
								tabFromSession.lastVisit = session.lastModified * 1000;

								return tabFromSession;
							})
							.filter(function(tab) {
								const url = tab.url;
								const existingTab = url in closedTabsByURL ||
									url in freshTabsByURL;

								closedTabsByURL[url] = true;

								return !existingTab;
							})
						);
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


	function navigate(
		direction,
		fromDoublePress)
	{
		var now = Date.now(),
				// if the user is double-pressing the popup shortcut, use 0 as
				// the lastShortcutTime so if they quickly do the double-press
				// twice within 750ms, it will just toggle instead of pushing
				// further back in the stack
			newData = {
				lastShortcutTime: fromDoublePress ? 0 : now,
				previousTabIndex: -1
			};


		function switchTabs(
			data)
		{
			var tabIDs = data.tabIDs,
				tabIDCount = tabIDs.length,
				maxIndex = tabIDCount - 1,
				previousTabIndex,
				previousTabID;

			if (now - data.lastShortcutTime < MaxSwitchDelay && data.previousTabIndex > -1) {
				if (direction == -1) {
						// when going backwards, wrap around if necessary
					previousTabIndex = (data.previousTabIndex - 1 + tabIDCount) % tabIDCount;
				} else {
						// don't let the user go past the most recently used tab
					previousTabIndex = Math.min(data.previousTabIndex + 1, maxIndex);
				}
			} else if (direction == -1) {
					// if the user is not actively navigating, we want to ignore
					// alt-S keypresses so the icon doesn't invert for no reason
				previousTabIndex = maxIndex - 1;
			}

				// if there's only one tab or the user pressed alt-S while not
				// navigating, this will be undefined and we'll just return
				// newData as-is below
			previousTabID = tabIDs[previousTabIndex];

			if (previousTabID) {
DEBUG && console.log("navigate previousTabIndex", previousTabID, previousTabIndex, titleOrURL(data.tabsByID[previousTabID]));
				newData.previousTabIndex = previousTabIndex;

					// we don't start the promise chain with windows.update
					// because we want to call it in a function so that if the
					// previous tab doesn't exist, it'll throw an exception and
					// we can handle it in the catch() below, instead of having
					// to duplicate the error handling code outside the chain.
				return Promise.resolve()
					.then(function() {
							// if the previous tab's data is not in tabsByID,
							// this will throw an exception that will be caught
							// below and the bad tab ID will be removed
						return cp.windows.update(data.tabsByID[previousTabID].windowId, { focused: true })
					})
					.then(function() {
						return cp.tabs.update(previousTabID, { active: true });
					})
					.catch(function(error) {
							// we got an error either because the previous
							// tab is no longer around or its data is not in
							// tabsByID, so remove it and update newData so
							// that the fixed data is saved when it's returned.
							// the current tab has now shifted into that position,
							// so set data.previousTabIndex to that so when we
							// recurse below, the next iteration will calculate
							// the previous tab starting from there.
						tabIDs.splice(previousTabIndex, 1);
						delete data.tabsByID[previousTabID];
						data.previousTabIndex = previousTabIndex;

						newData.tabIDs = tabIDs;
						newData.tabsByID = data.tabsByID;
DEBUG && console.error(error);

						return switchTabs(data);
					})
					.return(newData);
			} else {
				return newData;
			}
		}


			// we break the tab switching into a function so it can call itself
			// recursively if it hits a bad tab while navigating
		return storage.set(switchTabs, "navigate");
	}


	function print(
		count)
	{
		count = count || 20;

		cp.storage.local.get(null)
			.then(function(storage) {
				var data = storage.data,
					tabsByID = data.tabsByID;

				Promise.all(data.tabIDs.slice(-count).reverse().map(function(tabID) {
					return cp.tabs.get(tabID)
						.catch(function(error) {
							return tabID;
						});
					})
				)
					.then(function(tabs) {
						tabs.forEach(function(tab) {
							if (isNaN(tab)) {
								console.log("%c   ", "font-size: 14px; background: url(" +
									tab.favIconUrl + ") top center / contain no-repeat",
									tab.id + ": " + tabsByID[tab.id].lastVisit + ": " + titleOrURL(tab));
							} else {
								console.log("MISSING", tab);
							}
						});
					});
			});
	}


	return shared("recentTabs", {
		add: add,
		remove: remove,
		replace: replace,
		getAll: getAll,
		updateAll: updateAll,
		navigate: navigate,
		print: print
	});
});
