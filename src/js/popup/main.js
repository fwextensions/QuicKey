require([
	"jsx!popup/tab-selector",
	"react",
	"react-dom",
	"lodash"
], function(
	TabSelector,
	React,
	ReactDOM,
	_
) {
	if (gClose) {
			// the user hit esc before we started loading, so just close
			// the popup
		window.close();

		return;
	}

	chrome.tabs.query({}, function(tabs) {
		chrome.tabs.query({
			active: true,
			currentWindow: true
		}, function(activeTab) {
			var query = gKeyCache.join("");

				// clean up the globals
			document.removeEventListener("keydown", gOnKeyDown, false);
			gOnKeyDown = null;
			gKeyCache = null;

				// remove the active tab from the array so it doesn't show up in
				// the results, making it clearer if you have duplicate tabs open
			_.remove(tabs, { id: activeTab[0].id });

			ReactDOM.render(
				React.createElement(TabSelector, {
					tabs: tabs,
					initialQuery: query
				}),
				document.getElementById("content")
			);
		});
	});
});