define([
	"cp"
], function(
	cp
) {
	const MaxTabsLength = 50,
		MinDwellTime = 750;


	function store(
		data)
	{
			// arrays and objects that are updated don't seem to get saved with
			// the updated state, so make copies and store those
		if (data.tabIDs) {
			data.tabIDs = [].concat(data.tabIDs);
		}

		if (data.tabsByID) {
			data.tabsByID = Object.assign({}, data.tabsByID);
		}

		cp.storage.local.set(data);
	}


	function getDefaultStorage()
	{
		return cp.tabs.query({ active: true, currentWindow: true, windowType: "normal" })
			.then(function(tabs) {
				var storage = {
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


	function reset()
	{
		return getDefaultStorage()
			.then(function(storage) {
				chrome.storage.local.set(storage);

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


	function addTab(
		tab,
		fromFocusChange)
	{
		return getAll()
			.then(function(storage) {
				var id = tab.id,
					now = Date.now(),
					tabIDs = storage.tabIDs,
					tabsByID = storage.tabsByID,
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
					chrome.storage.local.set({ switchFromShortcut: false });

					return;
				}

					// make sure the ID isn't currently in the list
				tabIDs = tabIDs.filter(function(item) {
					return item != id;
				});

//				if (!storage.switchFromShortcut && !fromFocusChange && lastTab &&
//						(now - lastTab.recent < MinDwellTime)) {
//						// the previously active tab wasn't active for very long,
//						// so remove it from the list and the dictionary
//console.log("removing", lastID, lastTab.url);
//					delete tabsByID[tabIDs.pop()];
//				}

					// remove any older tabs that are over the max limit
				tabIDs.splice(0, Math.max(tabIDs.length - MaxTabsLength, 0)).forEach(function(id) {
					delete tabsByID[id];
				});

				tab.recent = now;
				tabIDs.push(id);
				tabsByID[id] = tab;

if (storage.switchFromShortcut) {
//	console.log(tabIDs.map(id => tabsByID[id].title).slice(-10).join("\n"));
}

				store({
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
console.log("tab closed", tabID);
					tabIDs.splice(index, 1);
				}

				delete tabsByID[tabID];

				store({
					tabIDs: tabIDs,
					tabsByID: tabsByID
				});
			});
	}


	return {
		reset: reset,
		getAll: getAll,
		getRecents: getRecents,
		addTab: addTab,
		removeTab: removeTab
	};
});
