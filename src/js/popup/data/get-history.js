define([
	"./add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	const RequestedItemCount = 2000,
		LoopItemCount = 1000;


	function loop(
		fn)
	{
		return fn().then(function(val) {
			return (val === true && loop(fn)) || val;
		});
	}


	return function getHistory()
	{
		var history = [],
			ids = {};

		return loop(function() {
			var endTime = (history.length && history[history.length - 1].lastVisitTime) ||
					Date.now();

			return cp.history.search({
				text: "",
				startTime: 0,
				endTime: endTime,
				maxResults: LoopItemCount
			})
				.then(function(historyItems) {
					var initialHistoryLength = history.length;

					historyItems.forEach(function(item) {
						var id = item.id;

							// history will often return duplicate items
						if (!ids[id] && history.length < RequestedItemCount) {
							addURLs(item);
							history.push(item);
							ids[id] = true;
						}
					});

						// only loop if we found some new items in the last call
						// and we haven't reached the limit yet
					if (history.length > initialHistoryLength && history.length < RequestedItemCount) {
						return true;
					} else {
						return history;
					}
				});
		});
	}
});
