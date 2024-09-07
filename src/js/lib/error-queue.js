globalThis.getQueuedErrors = (() => {
	let errors = [];

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

		// until the page has fully loaded, just catch and queue any exceptions
	addEventListener("error", queueError);
	addEventListener("unhandledrejection", queueError);

	return function getQueuedErrors()
	{
		const queuedErrors = errors;

		errors = null;
		removeEventListener("error", queueError);
		removeEventListener("unhandledrejection", queueError);

		return queuedErrors;
	}
})();
