define([
	"display-url",
	"cp"
], function(
	displayURL,
	cp
) {
	var history = [];


	function getHistory()
	{
		history = [];

		return cp.history.search({
			text: "",
			startTime: 0,
			maxResults: 200
		})
			.then(function(historyItems) {
				historyItems.forEach(function(item) {
					item.displayURL = displayURL(item.url);
					history.push(item);
				});

				return history;
			});
	}


	return getHistory;
});
