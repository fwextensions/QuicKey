define([
	"add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	var history = [];


	return function getHistory()
	{
		history = [];

		return cp.history.search({
			text: "",
			startTime: 0,
			maxResults: 200
		})
			.then(function(historyItems) {
				historyItems.forEach(function(item) {
					addURLs(item);
					history.push(item);
				});

				return history;
			});
	}
});
