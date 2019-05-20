(function() {
	const match = location.pathname.match(/\/(\w+)\.html/);
	const pageName = (match && match[1]) || "background";
	let errors = [];


	function queueError(
		event)
	{
		errors.push(event);
	}


	function init()
	{
		require([
			"background/page-trackers"
		], (
			trackers
		) => {
			const tracker = trackers[pageName] || trackers.background;

			window.removeEventListener("error", queueError);
			window.removeEventListener("unhandledrejection", queueError);

			window.addEventListener("error", event => tracker.exception(event, true));
			window.addEventListener("unhandledrejection", ({reason}) => tracker.exception(reason, true));
		});
	}


	window.addEventListener("error", queueError);
	window.addEventListener("unhandledrejection", queueError);

	if (pageName == "background") {
		setTimeout(init, 5000);
	} else {
		init();
	}
})();
