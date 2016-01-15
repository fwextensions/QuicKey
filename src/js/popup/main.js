require([
	"jsx!popup/tab-selector",
	"react",
	"react-dom"
], function(
	TabSelector,
	React,
	ReactDOM
) {
	if (gClose) {
			// the user hit esc before we started loading, so just close
			// the popup
		window.close();

		return;
	}

	chrome.tabs.query({}, function(tabs) {
		var query = gKeyCache.join("");

			// clean up the globals
		document.removeEventListener("keydown", gOnKeyDown, false);
		gOnKeyDown = null;
		gKeyCache = null;

		ReactDOM.render(
			React.createElement(TabSelector, {
				tabs: tabs,
				initialQuery: query
			}),
			document.getElementById("content")
		);
	});
});