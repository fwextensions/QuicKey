require([
	"cp"
], function(
	cp
) {
	function handleTabActivated(
		tabID,
		windowID)
	{
		console.log(tabID, windowID);

		cp.tabs.get(tabID)
			.then(function(tab) {
				addTabToStorage(tab);
			});
	}


	function handleFocusChanged(
		windowID)
	{
		if (windowID != chrome.windows.WINDOW_ID_NONE) {
			cp.windows.get(windowID, { populate: true })
				.then(function(window) {
					window.tabs.forEach(function(tab) {
						if (tab.active) {
							console.log("active", windowID, tab.id, tab.url);
							addTabToStorage(tab);
						}
					});
				});
		}
	}


	function getStorage()
	{
			// pass null to get everything in storage
		return cp.storage.local.get(null)
			.then(function(storage) {
				if (!storage || !storage.tabIDs) {
					return {
						tabIDs: [],
						tabsByID: {}
					};
				} else {
					return storage;
				}
			});
	}


	function addTabToStorage(
		tab)
	{
		return getStorage()
			.then(function(storage) {
				var id = tab.id,
					tabInfo = {
						id: id,
						url: tab.url,
						ts: Date.now()
					};

				storage.tabIDs.push(id);
				storage.tabsByID[id] = tabInfo;

				chrome.storage.local.set(storage);
			});
	}


	chrome.tabs.onActivated.addListener(handleTabActivated);
	chrome.windows.onFocusChanged.addListener(handleFocusChanged);
});
