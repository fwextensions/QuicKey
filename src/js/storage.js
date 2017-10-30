define([
	"cp"
], function(
	cp
) {
	const MaxTabsLength = 20,
		MinDwellTime = 750;


	function getAll()
	{
			// pass null to get everything in storage
		return cp.storage.local.get(null)
			.then(function(storage) {
				if (!storage || !storage.tabIDs) {
// TODO: add currently focused tab as the default
					return {
						tabIDs: [],
						tabsByID: {},
						switchFromShortcut: false
					};
				} else {
					return storage;
				}
			});
	}


	function addTab(
		tab)
	{
		return getAll()
			.then(function(storage) {
				var id = tab.id,
					now = Date.now(),
					tabInfo = {
						id: id,
						windowID: tab.windowId,
						url: tab.url,
						ts: now
					},
					tabIDs = storage.tabIDs,
					tabsByID = storage.tabsByID,
					lastID,
					lastTab;

// TODO: if there are only two items, and we're switching back to the previous one,
// we don't want to remove one that's < MinViewTime, because then there won't be
// a record of where to go back to

// TODO: pass in whether tab is being added because of a focus change
// then probably shouldn't remove last tab if it's a quick change, because the
// user is probably alt-tabbing between windows

// TODO: do we need an array?  could just have dictionary and last tab ID
// to generate a list of recent tabs, would have to sort by ts

// TODO: don't remove previous tab if it's < MinDwellTime if we switched to it
// because of the previous tab command key

// TODO: do we need to store more than two tabs?  we do if we want a list

				lastID =  tabIDs[tabIDs.length - 1];
				lastTab = tabsByID[lastID];

				if (lastTab && lastTab.url == tab.url && lastTab.id == tab.id &&
						lastTab.windowID == tab.windowId) {
						// this is the same tab getting refocused, which could
						// happen just from opening the extension and then
						// closing it without doing anything
					return;
				}

					// make sure the ID isn't currently in the list
				tabIDs = tabIDs.filter(function(item) {
					return item != id;
				});

				if (!storage.switchFromShortcut && lastTab &&
						(now - lastTab.ts < MinDwellTime)) {
						// the previously active tab wasn't active for very long,
						// so remove it from the list and the dictionary
console.log("removing", lastID, lastTab.url);
					delete tabsByID[tabIDs.pop()];
				}

					// remove any older tabs that are over the max limit
				tabIDs.splice(0, Math.max(tabIDs.length - MaxTabsLength, 0)).forEach(function(id) {
					delete tabsByID[id];
				});

				tabIDs.push(id);
				tabsByID[id] = tabInfo;

				chrome.storage.local.set({
					tabIDs: tabIDs,
					tabsByID: tabsByID,
					switchFromShortcut: false
				});
			});
	}


	function removeTab(
		tabID)
	{
		return getAll()
			.then(function(storage) {
				var tabIDs = storage.tabIDs,
					tabsByID = storage.tabsByID;

				var index = tabIDs.indexOf(tabID);

				if (index > -1) {
console.log("tab closed", tab.id, tab.url);
					tabIDs.splice(index, 1);
				}

				delete tabsByID[tab.id];

				chrome.storage.local.set({
					tabIDs: tabIDs,
					tabsByID: tabsByID
				});
			});
	}


	return {
		getAll: getAll,
		addTab: addTab,
		removeTab: removeTab
	};
});
