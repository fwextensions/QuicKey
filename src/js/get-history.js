define([
	"add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	var history = [];


	function promiseWhile(
		condition,
		action,
		value)
	{
		return Promise.resolve(value)
			.then(function(value) {
				if (!condition(value)) {
					return Promise.resolve(history);
				} else {
					return action(value)
						.then(function(value) {
							return promiseWhile(condition, action, value);
						});
				}
			});
	}


	var Continue = {}; // empty object serves as unique value

	function again() { return Continue; }
// 	var again = () => Continue;

	function repeat(
		fn)
	{
		return fn(again).then(function(val) {
			return val === Continue && repeat(fn) || val;
		});
	}

// 	var repeat = fn => Promise.try(fn, again)
// 		.then(val => val === Continue && repeat(fn) || val);


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

// 		return searchHistory()
// 			.then(function(historyItems) {
// 				historyItems.forEach(function(item) {
// 					addURLs(item);
// 					history.push(item);
// 				});
//
// 				if (historyItems && historyItems.length) {
// 					return searchHistory(historyItems[historyItems.length - 1].lastVisitTime);
// 				} else {
// 					return history;
// 				}
// 			});

		return promiseWhile(
			function(historyItems) {
				return historyItems && historyItems.length;
			},
			function(historyItems) {
				historyItems.forEach(function(item) {
					addURLs(item);
					history.push(item);
				});

				return historyItems;
// 				return searchHistory(historyItems[historyItems.length - 1].lastVisitTime);
			},
			searchHistory()
		)
	}

// 	return function getHistory()
// 	{
// 		history = [];
//
// 		return promiseWhile(
// 			function(historyItems) {
// 				return historyItems && historyItems.length;
// 			},
// 			function(historyItems) {
// 				historyItems.forEach(function(item) {
// 					addURLs(item);
// 					history.push(item);
// 				});
//
// 				return searchHistory(historyItems[historyItems.length - 1].lastVisitTime);
// 			},
// 			searchHistory()
// 		)
// 	}

// 	return function getHistory()
// 	{
// 		history = [];
//
// 		return cp.history.search({
// 			text: "",
// 			startTime: 0,
// 			maxResults: 10
// // 			maxResults: 500
// 		})
// 			.then(function(historyItems) {
// 				historyItems.forEach(function(item) {
// 					addURLs(item);
// 					history.push(item);
// 				});
//
// 				return history;
// 			});
// 	}
});
