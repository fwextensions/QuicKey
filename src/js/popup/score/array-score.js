define(function() {
	return function(
		score,
		searchKeyInfo)
	{
			// force keyNames to be an array
		var keys = [].concat(searchKeyInfo || "string").map(function(key) {
				if (typeof key != "object") {
					return {
						key: key,
						score: score
					};
				} else {
					return key;
				}
			}),
			defaultKeyName = keys[0];


		function compareScoredStrings(
			a,
			b)
		{
			if (a.score == b.score) {
				if (a.visits && b.visits) {
					return b.visits[b.visits.length - 1] - a.visits[a.visits.length - 1];
				} else {
					return a[defaultKeyName].toLocaleLowerCase() < b[defaultKeyName].toLocaleLowerCase() ? -1 : 1;
				}
			} else {
				return b.score - a.score;
			}
		}


		return function scoreArray(
			items,
			text)
		{
			if (items.length && !items[0].scores) {
				items.forEach(function(item) {
					item.score = 0;
					item.scores = {};
					item.hitMasks = {};

					keys.forEach(function(keyInfo) {
						item.scores[keyInfo.key] = 0;
						item.hitMasks[keyInfo.key] = [];
					});
				});
			}

			items.forEach(function(item) {
					// find the highest score for each keyed string on this item
				item.score = keys.reduce(function(currentScore, keyInfo) {
					var hitMask = [],
						key = keyInfo.key,
						newScore = keyInfo.score(item[key], text, hitMask) * (item.recentBoost || 1);

					item.scores[key] = newScore;
					item.hitMasks[key] = hitMask;

					return Math.max(currentScore, newScore);
				}, 0);
			});

			items.sort(compareScoredStrings);

			return items;
		}
	}
});
