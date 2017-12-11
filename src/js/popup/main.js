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

	const query = gKeyCache.join(""),
		shortcuts = gShortcutCache;

		// clean up the globals
	document.removeEventListener("keydown", gOnKeyDown, false);
	gOnKeyDown = null;
	gKeyCache = null;
	gShortcutCache = null;

	ReactDOM.render(
		React.createElement(App, {
			initialQuery: query,
			initialShortcuts: shortcuts,
			platform: /Mac/i.test(navigator.platform) ? "mac" : "win"
		}),
		document.getElementById("root")
	);
});