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
				return a[defaultKeyName].toLowerCase() < b[defaultKeyName].toLowerCase() ? -1 : 1;
			} else {
				return b.score - a.score;
			}
		}


		function compareNumbers(
			a,
			b)
		{
			return a - b;
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
						// we use a Set for the hitMask so that indexes can only
						// be added once
					var hitMask = new Set(),
						newScore = score(item[key], text, hitMask);

					item.scores[key] = newScore;

						// convert the hitMask to an Array, which is easier to
						// work with.  we have to sort it because the scorer may
						// find a partial match later in the string, and then
						// not find the rest of the query, so it starts over with
						// a shorter piece of the query, which it might find
						// earlier in the string.  in that case, the hitMask will
						// have later indexes first, which we slice off so that
						// the hitMask has at most the same number of indices as
						// the length of the query, though this might still
						// contain an extraneous hit.  and we have to sort the
						// array with a function that correctly sorts numbers,
						// because JavaScript.
					item.hitMasks[key] = Array.from(hitMask).sort(compareNumbers).slice(0, text.length);

					return Math.max(currentScore, newScore);
				}, 0);
			});

			items.sort(compareScoredStrings);

			return items;
		}
	}
});
