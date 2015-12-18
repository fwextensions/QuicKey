define(function() {
	return function(score, keyName) {
		keyName = keyName || "string";


		function compareScoredStrings(
			a,
			b)
		{
			if (a.score == b.score) {
				return a[keyName].toLowerCase() < b[keyName].toLowerCase() ? -1 : 1;
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

					obj[keyName] = string;

					return obj;
				});
			}

			strings.forEach(function(item) {
				item.score = score(item[keyName], text);
			});

			strings.sort(compareScoredStrings);

			return strings;
		}
	}
});
