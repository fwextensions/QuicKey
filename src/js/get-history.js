define([
	"cp"
], function(
	cp
) {
	const ProtocolPattern = /^[^:]+:\/\//;


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
					item.displayURL = unescape(item.url.replace(ProtocolPattern, ""));
					history.push(item);
				});

				return history;
			});
	}


	return getHistory;
});
