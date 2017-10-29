require([
	"storage",
	"cp"
], function(
	storage,
	cp
) {
	function handleTabActivated(
		event)
	{
console.log(event);

		cp.tabs.get(event.tabId)
			.then(function(tab) {
				storage.addTab(tab);
			});
	}


	function handleFocusChanged(
		windowID)
	{
		if (windowID != chrome.windows.WINDOW_ID_NONE) {
			cp.tabs.query({ active: true, windowId: windowID })
				.then(function(tabs) {
					if (tabs.length) {
console.log("active", windowID, tabs[0].id, tabs[0].url);

						storage.addTab(tabs[0]);
					}
				});
		}
	}


	chrome.tabs.onActivated.addListener(handleTabActivated);
	chrome.windows.onFocusChanged.addListener(handleFocusChanged);
});
