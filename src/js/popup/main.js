require([
	"jsx!popup/tab-selector",
	"react",
	"react-dom"
], function(
	TabSelector,
	React,
	ReactDOM
) {
	chrome.tabs.query({}, function(tabs) {
		ReactDOM.render(
			React.createElement(TabSelector, {
				tabs: tabs
			}),
			document.getElementById("content")
		);
	});
});