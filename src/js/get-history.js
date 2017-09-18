define([
	"add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
		// empty object serves as unique value
	const Continue = {};


	var history = [];


	function again() { return Continue; }


	function repeat(
		fn)
	{
		return fn(again).then(function(val) {
			return val === Continue && repeat(fn) || val;
		});
	}


	function searchHistory(
		endTime)
	{
		endTime = endTime || Date.now();

		return cp.history.search({
			text: "",
			startTime: 0,
			endTime: endTime,
			maxResults: 1000
		});
	}


	return function getHistory()
	{
		history = [];

		return repeat(function(again) {
			var endTime = history.length && history[history.length - 1].lastVisitTime || 0;

			return searchHistory(endTime)
				.then(function(historyItems) {
					if (historyItems.length && history.length < 2000) {
						historyItems.forEach(function(item) {
							addURLs(item);
							history.push(item);
						});

						return again();
					} else {
						return history;
					}
				});
		});
	}
});
