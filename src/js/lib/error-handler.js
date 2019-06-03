(function() {
	const match = location.pathname.match(/\/(\w+)\.html/);
	const pageName = (match && match[1]) || "background";
	let errors = [];


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
		require([
			"background/page-trackers"
		], (
			trackers
		) => {
			const tracker = trackers[pageName] || trackers.background;


			function handleError(
				event)
			{
				const timestamp = new Date().toLocaleString();

				if (event.reason) {
					console.error("Caught unhandled promise rejection:", event.reason, timestamp);
					tracker.exception(event.reason, true);
				} else if (event.preventDefault) {
					console.error("Caught unhandled exception:", event.error, timestamp);
					tracker.exception(event, true);
					event.preventDefault();
				}
			}


				// fire stats for any queued errors
			errors.forEach(event => handleError(event));
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
