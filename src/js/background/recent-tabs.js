define([
	"bluebird",
	"cp",
	"shared",
	"popup/data/add-urls",
	"./quickey-storage",
	"./page-trackers",
	"./constants"
], function(
	Promise,
	cp,
	shared,
	addURLs,
	storage,
	pageTrackers,
	{MinTabDwellTime}
) {
	const MaxTabsLength = 50;
	const TabKeys = ["id", "url", "windowId"];
	const PopupURL = `chrome-extension://${chrome.runtime.id}/popup.html`;


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
		let startIndex = 0;
		let index = -1;

		do {
			index = array.indexOf(item, startIndex);

			if (index > -1) {
				array.splice(index, 1);
				startIndex = index;
			}
		} while (index > -1);

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
		const recent = TabKeys.reduce((obj, key) => {
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
		const {tabIDs, tabsByID} = data;
		const freshTabsByURL = {};
			// start with an empty object so if there are old tabs lying around
			// that aren't listed in tabIDs they'll get dropped
		const newTabsByID = {};
		const newTabIDs = [];
		const tracker = pageTrackers.background;
		let missingCount = 0;
DEBUG && console.log("=== existing tabs", tabIDs.length, Object.keys(tabsByID).length, "fresh", freshTabs.length);

			// create a dictionary of the new tabs by the URL and
			// unsuspendURL, if any, so that a recent that had been
			// saved unsuspended and then was later suspended could
			// match up with the fresh, suspended tab
		freshTabs.forEach(tab => {
			addURLs(tab);
			freshTabsByURL[tab.url] = tab;
			tab.unsuspendURL && (freshTabsByURL[tab.unsuspendURL] = tab);
		});

			// we need to loop on tabIDs instead of just building a
			// hash and using Object.keys() to get a new list because
			// we want to maintain the recency order from tabIDs
		tabIDs.forEach(tabID => {
			const oldTab = tabsByID[tabID];
			let newTab = freshTabsByURL[oldTab && oldTab.url];

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
		tab,
		penultimately)
	{
			// ignore the extension's own popups
		if (!tab || tab.url.includes(PopupURL)) {
			return Promise.resolve();
		}

		return storage.set(({tabIDs, tabsByID}) => {
			const {id} = tab;
			const lastID = last(tabIDs);
			const lastTab = tabsByID[lastID];
			let tabData;

			if ((lastTab && lastTab.url == tab.url && lastTab.id == tab.id &&
					lastTab.windowId == tab.windowId)) {
					// this is the same tab getting refocused, which could
					// happen just from opening the extension and then
					// closing it without doing anything, so update its
					// lastVisit time to now
				addVisit(lastTab);

				return { tabsByID };
			}

				// copy just the keys we need from the tab object
			tabData = createRecent(tab, tabsByID[id]);
			addVisit(tabData);
			tabsByID[id] = tabData;

				// make sure the new tab's ID isn't currently in the list
			removeItem(tabIDs, id);

			if (penultimately) {
					// this is a tab that was opened in an inactive state, so we
					// want to insert it before the last item in the array, which
					// is the current tab, so that the new tab becomes the
					// "most recent" one before the current one.
				tabIDs.splice(-1, 0, id);

				if (lastTab) {
						// update the current tab so its lastVisit is later than
						// the inactive tab we just added.  that way, if the user
						// opens 5 tabs from a bookmark folder and switches to
						// the 5th, the MRU menu will show the current tab as
						// one they were most recently on, rather than the 4th
						// newly opened tab, since the menu is sorted by
						// lastVisit times.
					lastTab.lastVisit = tabData.lastVisit + 1;
				}
			} else {
					// this is now the frontmost tab, so add it at the end
				tabIDs.push(id);
			}

DEBUG && console.log("add", `${tab.id}|${tab.windowId}`, tabIDs.slice(-5), titleOrURL(tab));

				// remove any older tabs that are over the max limit
			tabIDs.splice(0, Math.max(tabIDs.length - MaxTabsLength, 0)).forEach(id => {
				delete tabsByID[id];
			});

			return { tabIDs, tabsByID };
		}, "addTab");
	}


	function remove(
		tabID)
	{
		if (isNaN(tabID)) {
			return;
		}

		return storage.set(({tabIDs, tabsByID}) => {
			const index = tabIDs.indexOf(tabID);

			if (index > -1) {
DEBUG && console.log("tab closed", tabID, titleOrURL(tabsByID[tabID]));
				tabIDs.splice(index, 1);
			}

				// the user might have focused the tab, then focused 50+ more
				// tabs, and then closed this one without focusing it again.  so
				// it would be in tabsByID but not tabIDs.
			delete tabsByID[tabID];

			return { tabIDs, tabsByID };
		}, "removeTab");
	}


	function replace(
		oldID,
		newID)
	{
		return storage.set(({tabIDs, tabsByID}) => {
			const index = tabIDs.indexOf(oldID);
			const oldTab = tabsByID[oldID];
			const newData = {};

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


	function getAll(
		includeClosedTabs)
	{
		return storage.get(data => {
			return Promise.all([
				cp.tabs.query({}),
				includeClosedTabs ? cp.sessions.getRecentlyClosed() : []
			])
				.spread((freshTabs, closedTabs) => {
					const {tabIDs, lastUpdateTime, lastStartupTime} = data;
					const tabsByURL = {};
					let {tabsByID} = data;
					let newData = { tabsByID };
					let tabs = freshTabs.filter(({url}) => !url.includes(PopupURL));

						// lastUpdateTime shouldn't be undefined, but just in case
					if (isNaN(lastUpdateTime) || lastStartupTime > lastUpdateTime) {
DEBUG && console.log("====== calling updateFromFreshTabs");

						newData = updateFromFreshTabs(data, tabs);
						tabsByID = newData.tabsByID;
					}

						// update the fresh tabs with any recent data we have
					tabs = tabs.map(tab => {
						const {id, url} = addURLs(tab);
						const oldTab = tabsByID[id];
						let lastVisit = 0;

						if (oldTab) {
								// point the recent tab at the refreshed tab so
								// that if the tab's URL had changed since the
								// last time the user focused it, we'll store
								// the current URL with the recent data.  that
								// way, when Chrome restarts and we try to match
								// the saved recents against the new tabs, we'll
								// be able to match it by URL.
							tabsByID[id] = createRecent(tab, oldTab);
							lastVisit = tabsByID[id].lastVisit;
						}

						tab.lastVisit = lastVisit;
						tabsByURL[url] = true;

							// if the tab is suspended, also store it with the
							// unsuspendURL so that we can dedupe it against
							// closed unsuspended tabs below
						tab.unsuspendURL && (tabsByURL[tab.unsuspendURL] = true);

						return tab;
					});

						// only show the closed tabs if we also have some recent
						// tabs, so that the user doesn't see just closed tabs on
						// a new install.  have to check for > 1, since even on a
						// new install or after closing a window, the current tab
						// will be in the list, but is then removed from the list
						// in getTabs().
					if (tabIDs.length > 1) {
						const uniqueClosedTabs = [];

							// convert the sessions to tab objects, including
							// all the tabs in closed windows, and dedupe them
							// by URL, keeping the most recent version of each
						closedTabs.forEach(session => {
								// session lastModified times are in Unix epoch
							const lastVisit = session.lastModified * 1000;

							[].concat(session.tab || session.window.tabs).forEach(tab => {
								if (!(tab.url in tabsByURL) && !tab.url.includes(PopupURL)) {
									tabsByURL[tab.url] = true;
									tab.lastVisit = lastVisit;
									addURLs(tab);
									uniqueClosedTabs.push(tab);
								}
							});
						});

						tabs = tabs.concat(uniqueClosedTabs);
					}

						// save off the updated recent data.  we don't call
						// storage.set() for getAll() so that the popup doesn't
						// have to wait for the data to get stored before it's
						// returned, to make the recents menu render faster.
					storage.set(() => newData);

					return tabs;
				});
		});
	}


	function updateAll()
	{
		return storage.set(data => cp.tabs.query({})
			.then(freshTabs => {
DEBUG && console.log("=== updateAll");
				return updateFromFreshTabs(data, freshTabs);
			}), "updateAll");
	}


	function navigate(
		direction,
		limitToCurrentWindow)
	{
		const now = Date.now();
		const newData = {
			lastShortcutTime: now,
			previousTabIndex: -1
		};


		function calcNavigationIndex(
			direction,
			index,
			count)
		{
			let newIndex;

			if (direction == -1) {
					// when going backwards, wrap around if necessary
				newIndex = (index - 1 + count) % count;
			} else {
					// don't let the user go past the most recently used tab
				newIndex = Math.min(index + 1, count - 1);
			}

			return newIndex;
		}


		function switchTabs(
			data)
		{
			const {tabIDs, tabsByID} = data;
			const tabIDCount = tabIDs.length;
			const maxIndex = tabIDCount - 1;
			let previousTabIndex;

			if (now - data.lastShortcutTime < MinTabDwellTime && data.previousTabIndex > -1) {
				if (direction == -1) {
						// when going backwards, wrap around if necessary
					previousTabIndex = (data.previousTabIndex - 1 + tabIDCount) % tabIDCount;
				} else {
						// don't let the user go past the most recently used tab
					previousTabIndex = Math.min(data.previousTabIndex + 1, maxIndex);
				}
			} else if (direction == -1) {
					// if the user is not actively navigating, we want to ignore
					// alt-S keypresses so the icon doesn't invert for no reason,
					// so we only set previousTabIndex when going backwards
				previousTabIndex = maxIndex - 1;
			}

				// if there's only one tab or the user pressed alt-S while not
				// navigating, this will be undefined and we'll just return
				// newData as-is below
			const previousTabID = tabIDs[previousTabIndex];

			if (previousTabID) {
DEBUG && console.log("navigate previousTabIndex", previousTabID, previousTabIndex, tabIDs.slice(-5), titleOrURL(tabsByID[previousTabID]));
				if (limitToCurrentWindow) {
					const currentTab = tabsByID[tabIDs[maxIndex]];
					const previousTab = tabsByID[previousTabID];

					if (previousTab && currentTab
							&& previousTab.windowId !== currentTab.windowId) {
						data.previousTabIndex = calcNavigationIndex(direction,
							data.previousTabIndex, tabIDCount);

							// we need to set lastShortcutTime to now so that
							// when we recur, we'll hit the first if branch and
							// move farther back into the stack.  otherwise,
							// previousTabIndex would keep getting set to the
							// penultimate tab in tabIDs.
						data.lastShortcutTime = now;

						return switchTabs(data);
					}
				}

				newData.previousTabIndex = previousTabIndex;

					// we don't start the promise chain with windows.update
					// because we want to call it in a function so that if the
					// previous tab doesn't exist, it'll throw an exception and
					// we can handle it in the catch() below, instead of having
					// to duplicate the error handling code outside the chain.
				return Promise.resolve()
						// if the previous tab's data is not in tabsByID,
						// this will throw an exception that will be caught
						// below and the bad tab ID will be removed
					.then(() => cp.windows.update(tabsByID[previousTabID].windowId,
						{ focused: true }))
					.then(() => cp.tabs.update(previousTabID, { active: true }))
					.catch(error => {
							// we got an error either because the previous
							// tab is no longer around or its data is not in
							// tabsByID, so remove it and update newData so
							// that the fixed data is saved when it's returned.
							// the current tab has now shifted into that position,
							// so set data.previousTabIndex to that so when we
							// recurse below, the next iteration will calculate
							// the previous tab starting from there.
						tabIDs.splice(previousTabIndex, 1);
						delete tabsByID[previousTabID];
						data.previousTabIndex = previousTabIndex;

						newData.tabIDs = tabIDs;
						newData.tabsByID = tabsByID;
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


	function toggle(
		limitToCurrentWindow)
	{
			// set previousTabIndex to -1 in case the user had been navigating
			// back into the stack and then pressed the toggle shortcut within
			// 750ms.  if previousTabIndex was still set, we'd toggle to the
			// wrong tab.
		return storage.set(() => ({ lastShortcutTime: 0, previousTabIndex: -1 }), "toggle")
			.then(() => navigate(-1, limitToCurrentWindow));
	}


	function print(
		count = 20)
	{
		return cp.storage.local.get(null)
			.then(({data}) => {
				const {tabsByID, tabIDs} = data;

				Promise.all(
					tabIDs.slice(-count).reverse().map(tabID =>
						cp.tabs.get(tabID).catch(() => tabID)
					)
				)
					.then(tabs => tabs.forEach(tab => {
						if (isNaN(tab)) {
							console.log("%c   ",
								`font-size: 14px; background: url(${tab.favIconUrl}) top center / contain no-repeat`,
								`${tab.id}|${tab.windowId}: ${tabsByID[tab.id].lastVisit}: ${titleOrURL(tab)}`);
						} else {
							console.log("MISSING", tab);
						}
					}));
			});
	}


	return shared("recentTabs", {
		add,
		remove,
		replace,
		getAll,
		updateAll,
		navigate,
		toggle,
		print
	});
});
