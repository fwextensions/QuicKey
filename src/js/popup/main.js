require([
	"react",
	"react-dom",
	"jsx!popup/app",
	"background/page-trackers"
], function(
	React,
	ReactDOM,
	App,
	trackers
) {
	const initialQuery = gKeyCache.join("");
	const initialShortcuts = gShortcutCache;
	const platform = /Mac/i.test(navigator.platform) ? "mac" : "win";
	const now = performance.now();
	const tracker = trackers.popup;
	const params = new URLSearchParams(location.search);

	if (gClose) {
			// the user hit esc before we started loading, so just close the
			// popup.  however, this seems to never get triggered.  either the
			// browser hears the esc and closes the popup without us getting
			// notified, or the input gets focused and then gets the esc event.
		gPort.postMessage("closedByEsc");
		window.close();

		return;
	}

	DEBUG && console.log("=== popup startup time", now - gInitTime, now);
	window.log && log("=== popup startup time", now - gInitTime, now);

	if (tracker) {
			// send a pageview event after a delay, in case the user is toggling
			// to the previous tab, in which case we'll barely be rendered, and
			// so don't want to count a pageview
		setTimeout(() => {
			tracker.pageview();
			tracker.timing("loading", "popup", now);
		}, 750);
	}

		// clean up the globals
	document.removeEventListener("keydown", gOnKeyDown, false);
	gOnKeyDown = null;
	gKeyCache = null;
	gShortcutCache = null;


	function renderApp()
	{
		ReactDOM.render(
			React.createElement(App, {
				initialQuery,
				initialShortcuts,
				platform,
				tracker,
				port: gPort
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
