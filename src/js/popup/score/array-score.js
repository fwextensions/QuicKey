define(function() {
	return function(
		score,
		searchKeyInfo)
	{
			// force keyNames to be an array
		const keys = [].concat(searchKeyInfo || "string").map(key =>
			typeof key != "object"
				? { key, score }
				: key
		);
		const defaultKeyName = keys[0].key;


		function compareScoredStrings(
			a,
			b)
		{
			if (a.score == b.score) {
				if (a.lastVisit && b.lastVisit) {
					return b.lastVisit - a.lastVisit;
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

					keys.forEach(({key}) => {
						item.scores[key] = 0;
						item.hitMasks[key] = [];
					});
				});
			}

			items.forEach(item => {
					// find the highest score for each keyed string on this item
				item.score = keys.reduce((currentScore, {key, score}) => {
					const hitMask = [];
					const string = item[key];
						// score empty strings as 0
					const newScore = string
						? score(string, text, hitMask) * (item.recentBoost || 1)
						: 0;

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
