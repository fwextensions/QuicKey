require([
	"jsx!popup/app",
	"react",
	"react-dom"
], function(
	App,
	React,
	ReactDOM
) {
	console.log("startup time", performance.now() - gInitTime, performance.now());

	if (gClose) {
			// the user hit esc before we started loading, so just close
			// the popup
		window.close();

		return;
	}

	var query = gKeyCache.join("");

		// clean up the globals
	document.removeEventListener("keydown", gOnKeyDown, false);
	gOnKeyDown = null;
	gKeyCache = null;

	ReactDOM.render(
		React.createElement(App, {
			initialQuery: query,
			platform: /Win/i.test(navigator.platform) ? "win" : "mac"
		}),
		document.getElementById("root")
	);
});