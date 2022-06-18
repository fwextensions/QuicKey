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

				// add a flag so we know that preventDefault() was called while
				// we were queuing errors, and not by the console errors that
				// Chromium v102 triggers
			event.queued = true;
		}
	}


	function getStack(
		error)
	{
		return (error && error.stack && error.stack.replace(PathPattern, "")) || "";
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
				if (event.defaultPrevented && !event.queued) {
						// the devtools console in Chromium v102 triggers
						// unhandled errors while you type, with defaultPrevented
						// set to true.  so ignore those errors, but only if
						// they weren't queued while we were starting up, which
						// mean they're legitimate.
					return;
				}

				try {
					const timestamp = new Date().toLocaleString();
					const {detail, reason = ((detail && detail.reason) || "")} = event;
					const stack = getStack(event.error) || getStack(reason);
					const type = event.type == "unhandledrejection"
						? "promise rejection"
						: "exception";
					const errorMessage = `Caught unhandled ${type} at ${timestamp}:\n${stack}`;

					console.error(errorMessage);
					tracker.exception(errorMessage, true);

					if (event.preventDefault) {
						event.preventDefault();
					}
				} catch (e) {
					console.error("Unhandled error in the error handler (oh, the irony!)", e);
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
