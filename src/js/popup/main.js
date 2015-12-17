require([
	"jsx!popup/tab-selector",
	"react",
	"react-dom",
	"jquery",
	"lodash"
], function(
	TabSelector,
	React,
	ReactDOM,
	$,
	_
) {
	chrome.tabs.query({}, function(tabs) {
console.log(tabs);

		ReactDOM.render(
			React.createElement(TabSelector, {
				tabs: tabs
			}),
			document.getElementById("content")
		);
	});
});