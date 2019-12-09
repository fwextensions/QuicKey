(function() {
	const PathPattern = /chrome-extension:\/\/[^\n]+\//g;
	const MaxRetries = 20;


	const match = location.pathname.match(/\/(\w+)\.html/);
	const pageName = (match && match[1]) || "background";
	let errors = [];
	let retryCount = 0;


	function queueError(
		event)
	{
		errors.push(event);

		if (event.preventDefault) {
			event.preventDefault();
		}
	}


	function init()
	{
		if (typeof require !== "function" && retryCount < MaxRetries) {
				// we've been loaded before the global require is set up, so
				// wait a bit and try again
			setTimeout(init, 100);
			retryCount++;

			return;
		}

		require([
			"background/page-trackers"
		], (
			trackers
		) => {
			const tracker = trackers[pageName] || trackers.background;


			function handleError(
				event)
			{
				try {
					const timestamp = new Date().toLocaleString();

					if (event.reason) {
						console.log(`Caught unhandled promise rejection at ${timestamp}: ${event.reason}`);
						tracker.exception(event.reason, true);
					} else if (event.preventDefault) {
							// error may be null in some cases, like when
							// running a script in the console
						const {error} = event;
						const stack = (error && error.stack &&
							error.stack.replace(PathPattern, "")) || "";

						console.log(`Caught unhandled exception at ${timestamp}:\n${stack}`);
						tracker.exception(error, true);
						event.preventDefault();
					}
				} catch (e) {
					console.log("Unhandled error in the error handler (oh, the irony!)", e);
				}
			}


				// fire exception stats for any queued errors
			errors.forEach(handleError);
			errors = null;

			window.removeEventListener("error", queueError);
			window.removeEventListener("unhandledrejection", queueError);

			window.addEventListener("error", handleError);
			window.addEventListener("unhandledrejection", handleError);
		});
	}


		// until the require loads and the page trackers are available, just
		// catch and queue any exceptions
	window.addEventListener("error", queueError);
	window.addEventListener("unhandledrejection", queueError);

	if (pageName == "background") {
			// give the background page some time to set up the dimensions in
			// the trackers before firing GA events for the cached exceptions
		setTimeout(init, 3000);
	} else {
		init();
	}
})();
