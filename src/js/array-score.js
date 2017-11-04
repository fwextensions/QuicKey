define(function() {
	return function(score, keyNames) {
			// force keyNames to be an array
		keyNames = [].concat(keyNames || "string");

		var defaultKeyName = keyNames[0];


		function compareScoredStrings(
			a,
			b)
		{
			if (a.score == b.score) {
				if (a.recent) {
					return b.recent - a.recent;
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

					keyNames.forEach(function(key) {
						item.scores[key] = 0;
						item.hitMasks[key] = [];
					});
				});
			}

			items.forEach(function(item) {
					// find the highest score for each keyed string on this item
				item.score = keyNames.reduce(function(currentScore, key) {
					var hitMask = [],
						newScore = score(item[key], text, hitMask);

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
