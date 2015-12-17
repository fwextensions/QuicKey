define(function() {
	function compareScoredStrings(
		a,
		b)
	{
		if (a.score == b.score) {
			return a.string.toLowerCase() < b.string.toLowerCase() ? -1 : 1;
		} else {
			return b.score - a.score;
		}
	}


	return function(score) {
		return function scoreArray(
			strings,
			text)
		{
			if (typeof strings[0] != "object") {
				strings = strings.map(function(string) {
					return {
						string: string,
						score: 0
					};
				});
			}

			strings.forEach(function(item) {
				item.score = score(item.string, text);
			});

			strings.sort(compareScoredStrings);

			return strings;
		}
	}
});
