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


		return function scoreArray(
			strings,
			text)
		{
			if (typeof strings[0] != "object") {
				strings = strings.map(function(string) {
					var obj = {
							score: 0
						};

					obj[defaultKeyName] = string;

					return obj;
				});
			}

			strings.forEach(function(item) {
					// add the scores for each keyed string on this item
				item.score = keyNames.reduce(function(currentScore, key, i) {
						// reduce the impact of the scores from secondary keys  
					return currentScore + (score(item[key], text) * (i ? .25 : 1));
				}, 0);
			});

			strings.sort(compareScoredStrings);

			return strings;
		}
	}
});
