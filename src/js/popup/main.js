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
		shortcuts = gShortcutCache,
		platform = /Mac/i.test(navigator.platform) ? "mac" : "win";

		// clean up the globals
	document.removeEventListener("keydown", gOnKeyDown, false);
	gOnKeyDown = null;
	gKeyCache = null;
	gShortcutCache = null;


	function renderApp()
	{
		ReactDOM.render(
			React.createElement(App, {
				initialQuery: query,
				initialShortcuts: shortcuts,
				platform: platform
			}),
			document.getElementById("root")
		);
	}


	if (platform == "mac") {
			// there's a bug in Mac Chrome that causes the popup to not resize
			// if the content changes too soon.  75ms seems to be enough of a
			// delay to not see it, while 50ms would still show it maybe 1 out
			// 20 times, and 0ms about 1 out of 3.
		setTimeout(renderApp, 75);
	} else {
		renderApp();
	}
});