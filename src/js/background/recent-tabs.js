import addURLs from "@/popup/data/add-urls";
import {getRelativeTime} from "@/lib/get-relative-time";
import storage from "./quickey-storage";
import pageTrackers from "./page-trackers";
import {MaxRecentTabs as MaxTabsLength, MinTabDwellTime, PopupURL} from "./constants";
import log from "./persistent-log";


const TabKeys = ["id", "url", "windowId"];
	// how many unmatched recents updateFromFreshTabs() names individually in the
	// persistent log before falling back to just the count
const MaxMissingToLog = 3;


function titleOrURL(
	tab,
	length = 75)
{
	if (!tab) {
		return "NO TAB";
	} else {
		return (tab.title || tab.url).slice(0, length);
	}
}


function getRecentStackString(
	tabIDs)
{
	return `[${tabIDs.slice(-5).join(",")}]`;
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


	// when retainUnmatched is true, recents that don't match any fresh tab are
	// kept under their old IDs instead of being dropped.  that's used during
	// Chrome's startup, where a restored tab that hasn't been loaded yet may
	// not have its URL populated, so an unmatched recent doesn't necessarily
	// mean the tab is gone -- it may just not be ready to match yet.  a later
	// pass with retainUnmatched false drops whatever's still unmatched.
function updateFromFreshTabs(
	data,
	freshTabs,
	retainUnmatched)
{
DEBUG && console.log("=== updateFromFreshTabs", data, freshTabs);
	const {tabIDs, tabsByID} = data;
	const freshTabIDs = new Set(freshTabs.map(({id}) => id));
	const freshTabsByURL = {};
		// start with an empty object so if there are old tabs lying around
		// that aren't listed in tabIDs they'll get dropped
	const newTabsByID = {};
	const newTabIDs = [];
	const tracker = pageTrackers.background;
	let missingCount = 0;
	let retainedCount = 0;
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

				// log only the first few.  a failed startup match misses every
				// recent, so this was emitting 50 lines a pass -- two restarts
				// filled a quarter of the log's 400 entries with one fact and
				// pushed out the surrounding history.  the summary below carries
				// the totals; these are just for a sense of what didn't match.
			if (missingCount <= MaxMissingToLog) {
				log("updateFromFreshTabs: no fresh tab matches recent",
					tabID, oldTab?.lastVisit, oldTab?.url?.slice(0, 100));
			}

				// hang on to the old recent so a later pass can still match it
				// once the tab finishes restoring.  skip it if a fresh tab has
				// already claimed this ID, since reusing it would overwrite a
				// real tab's entry with stale data.
			if (retainUnmatched && oldTab && !freshTabIDs.has(tabID)) {
				newTabsByID[tabID] = oldTab;
				newTabIDs.push(tabID);
				retainedCount++;
			}
		}
	});
	log("updateFromFreshTabs:",
		"old recents:", tabIDs.length,
		"fresh tabs:", freshTabs.length,
		"matched:", newTabIDs.length - retainedCount,
		"missing:", missingCount,
		...(missingCount > MaxMissingToLog
			? [`(${missingCount - MaxMissingToLog} not listed above)`]
			: []),
		"retained:", retainedCount);

		// use timing() instead of event() so that we can get a histogram in
		// GA of the different values, which is hard with events
	tracker.event("update", "old-recents", tabIDs.length);
	tracker.event("update", "new-tabs", freshTabs.length);
	tracker.event("update", "missing-recents", missingCount);

	const result = {
		tabIDs: newTabIDs,
		tabsByID: newTabsByID,
			// only claim we've reconciled the recents if we had a real tab list
			// to reconcile them against.  an empty freshTabs means Chrome hasn't
			// restored the session yet, not that every recent is gone, and
			// getAll() keys its rebuild off lastStartupTime > lastUpdateTime --
			// so leaving this unwritten is what lets a later pass retry.  a
			// populated list that matched nothing IS a real answer: those tabs
			// are closed, and running again won't bring them back.
		...(freshTabs.length > 0 ? { lastUpdateTime: Date.now() } : {}),
			// not stored -- updateAll() strips these off and returns them, so
			// the startup sequence can tell whether another pass is worthwhile.
			// pendingCount is the one that matters there: a recent can be
			// missing simply because its tab was closed before the restart, and
			// no amount of retrying will bring it back, but a tab with no URL
			// yet is one we genuinely can't match until it's finished loading.
		missingCount,
		pendingCount: freshTabs.filter(({url}) => !url).length
	};
DEBUG && console.log("updateFromFreshTabs result", result);

	return result;
}


function add(
	tab,
	penultimately)
{
		// ignore the extension's own popups.  a tab we can't see a URL for
		// definitely isn't one of ours, so let it through rather than throwing
		// here, the same way isPopupWindow() treats a missing URL.
	if (!tab || tab.url?.includes(PopupURL)) {
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

DEBUG && console.log("add", `${tab.id}|${tab.windowId}`, getRecentStackString(tabIDs), titleOrURL(tab));

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
			tabIDs.splice(index, 1);
DEBUG && console.log("tab closed", tabID, getRecentStackString(tabIDs), titleOrURL(tabsByID[tabID]));
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
DEBUG && console.log("tab replaced", oldID, "index", index, getRecentStackString(tabIDs), titleOrURL(oldTab));
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
const t = performance.now();

	return storage.get(data => {
			// time the two API calls separately, since getAll() has been seen
			// taking 7s+ on a slow machine with a lot of tabs and we can't tell
			// from the total which of them is responsible.  they run
			// concurrently, so the total is the slower of the two, not the sum.
		const apiTime = performance.now();
		let queryDuration = 0;
		let sessionsDuration = 0;

		return Promise.all([
			chrome.tabs.query({})
				.then(result => (queryDuration = performance.now() - apiTime, result)),
			includeClosedTabs
				? chrome.sessions.getRecentlyClosed()
					.then(result => (sessionsDuration = performance.now() - apiTime, result))
				: []
		])
			.then(([freshTabs, closedTabs]) => {
				log("getAll:",
					"tabs.query:", Math.round(queryDuration), "ms for",
					freshTabs.length, "tabs,",
					"sessions.getRecentlyClosed:", Math.round(sessionsDuration), "ms");

				const {lastStartupTime = 0, lastUpdateTime = 0} = data;
				const tabsByURL = {};
				let {tabIDs, tabsByID} = data;
				let rebuilt;

					// a Chrome restart regenerates every tab ID, so the stored
					// recents have to be rematched to the restored tabs by URL.
					// onStartup does that, but it can finish having matched
					// nothing -- most often because the worker woke before Chrome
					// restored any tabs -- and nothing else ever retries, so the
					// recents stay pointed at dead IDs until the next restart.
					// lastUpdateTime is only written once a pass had a real tab
					// list, so this stays true until a rebuild actually happens.
					//
					// the freshTabs guard is the same invariant: an empty query
					// is not evidence that the recents are gone, and rebuilding
					// against it would drop all of them.
				if (lastStartupTime > lastUpdateTime && freshTabs.length > 0) {
						// always retain what didn't match.  a recent with no fresh
						// tab may belong to a tab Chrome hasn't restored yet, and
						// there's no telling that apart from a tab that's really
						// closed: an unrestored tab is *absent* from the query,
						// not present without a URL, so counting URL-less tabs
						// doesn't detect it.  dropping a live recent can't be
						// undone, while keeping a dead one costs a slot in tabIDs
						// and is invisible in the menu, which is built from the
						// fresh tabs.  navigate() clears out dead entries anyway,
						// and you're far likelier to open the menu looking for a
						// tab mid-restore than to be paging through the MRU stack.
					const {missingCount, ...update} = updateFromFreshTabs(data, freshTabs, true);

					log("getAll: rebuilt recents after startup didn't",
						"lastStartupTime:", lastStartupTime,
						"lastUpdateTime:", lastUpdateTime,
						"fresh tabs:", freshTabs.length,
						"missing:", missingCount);

					rebuilt = update;
					({tabIDs, tabsByID} = update);
				}

// TODO: should use startsWith
				let tabs = freshTabs.filter(({url}) => !url?.includes(PopupURL));

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

						// don't key the dedupe hash off a tab we have no URL
						// for, or every closed tab that's also missing one
						// would dedupe against the "undefined" key below
					url && (tabsByURL[url] = true);

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
				if (includeClosedTabs) {
						// tabIDs.length <= 1 suppresses closed tabs below, so
						// log it to correlate "closed tabs not shown" reports
						// with an empty/reset recents list after a restart
					log("getAll:",
						"recents:", tabIDs.length,
						"closed sessions:", closedTabs.length,
						"showing closed:", tabIDs.length > 1);
				}

				if (tabIDs.length > 1) {
					const uniqueClosedTabs = [];

						// convert the sessions to tab objects, including
						// all the tabs in closed windows, and dedupe them
						// by URL, keeping the most recent version of each
					closedTabs.forEach(session => {
							// session lastModified times are in Unix epoch
						const lastVisit = session.lastModified * 1000;

						[].concat(session.tab || session.window.tabs).forEach(tab => {
							if (!(tab.url in tabsByURL) && !tab.url?.includes(PopupURL)) {
								tabsByURL[tab.url] = true;
								tab.lastVisit = lastVisit;
								addURLs(tab);
								uniqueClosedTabs.push(tab);
							}
						});
					});

					tabs = tabs.concat(uniqueClosedTabs);
				}

					// save off the updated recent data.  we don't await this
					// storage.set() so that the popup doesn't have to wait
					// for the data to get stored before it's returned, to
					// make the recents menu render faster.  when we rebuilt
					// above, the new tabIDs and lastUpdateTime have to go with
					// it -- lastUpdateTime is what stops the rebuild from
					// running again on the next open.
				storage.set(() => ({ ...rebuilt, tabsByID }));

DEBUG && console.log("getAll took", performance.now() - t, "ms");
				return tabs;
			});
	});
}


	// resolves to { missingCount, pendingCount }: how many stored recents
	// didn't match an open tab, and how many open tabs have no URL to match
	// against yet.  pass retainUnmatched to keep unmatched recents around for
	// a later pass, rather than dropping them.
function updateAll(
	retainUnmatched)
{
	let stats = { missingCount: 0, pendingCount: 0 };

	return storage.set(data => {
		const queryTime = performance.now();

		return chrome.tabs.query({})
			.then(freshTabs => {
					// tabs.query() is the expensive part of the startup passes
					// on a machine with a lot of tabs, so log what it costs
				log("updateAll: tabs.query took",
					Math.round(performance.now() - queryTime), "ms for",
					freshTabs.length, "tabs",
					retainUnmatched ? "(retaining unmatched)" : "");

					// the counts are only for the caller, so keep them out of
					// the object we hand back to storage.set() to be saved
				const {missingCount, pendingCount, ...update} =
					updateFromFreshTabs(data, freshTabs, retainUnmatched);

				stats = { missingCount, pendingCount };

					// lastStartupTime is written by the onStartup handler before
					// any of this runs, so that a startup whose passes all fail
					// still leaves lastStartupTime > lastUpdateTime for getAll()
					// to notice.  writing it here would defeat that: it would
					// always land alongside lastUpdateTime and the two could
					// never disagree.
				return update;
			});
	}, "updateAll")
		.then(() => stats);
}


function navigate(
	direction,
	limitToCurrentWindow)
{
	const now = Date.now();
	const newData = {
			// only record the lastShortcutTime if we're actually navigating
			// through the stack and not toggling between the two most recent
		lastShortcutTime: direction == "toggle" ? 0 : now,
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

		if (direction == "toggle") {
			previousTabIndex = maxIndex - 1;
		} else if (now - data.lastShortcutTime < MinTabDwellTime && data.previousTabIndex > -1) {
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
DEBUG && console.log("navigate previousTabIndex", previousTabID, previousTabIndex, getRecentStackString(tabIDs), titleOrURL(tabsByID[previousTabID]));
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

			if (direction === "toggle") {
					// toggling recents shouldn't affect the navigation stack
				newData.previousTabIndex = -1;
			} else {
				newData.previousTabIndex = previousTabIndex;
			}

				// we don't start the promise chain with windows.update
				// because we want to call it in a function so that if the
				// previous tab doesn't exist, it'll throw an exception and
				// we can handle it in the catch() below, instead of having
				// to duplicate the error handling code outside the chain.
			return Promise.resolve()
					// if the previous tab's data is not in tabsByID,
					// this will throw an exception that will be caught
					// below and the bad tab ID will be removed
				.then(() => chrome.windows.update(tabsByID[previousTabID].windowId,
					{ focused: true }))
				.then(() => chrome.tabs.update(previousTabID, { active: true }))
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
				.then(() => newData);
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
	return navigate("toggle", limitToCurrentWindow);
}


function print(
	count = 20,
	data)
{
		// use the data passed in by the caller, or else get it from storage
	return Promise.resolve(data || storage.get())
		.then(({tabsByID, tabIDs}) =>
			Promise.all(
				tabIDs.slice(-count).reverse().map(tabID =>
					chrome.tabs.get(tabID).catch(() => tabID)
				)
			)
				.then(tabs => {
					const rows = tabs.map(tab => {
						if (tab?.id) {
							return `${tab.id}|${tab.windowId}: ${getRelativeTime(tabsByID[tab.id].lastVisit)}: ${titleOrURL(tab)}`;
						} else {
							return "MISSING: " + tab;
						}
					});

					console.log("\n" + rows.join("\n"));
				})
		);
}


if (DEBUG) {
	globalThis.printTabs = print;
}


export default {
	add,
	remove,
	replace,
	getAll,
	updateAll,
	navigate,
	toggle,
	print
};
