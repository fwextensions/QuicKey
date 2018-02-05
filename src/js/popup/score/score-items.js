define([
	"./quick-score",
	"./simple-score",
	"./array-score"
], function(
	quickScore,
	simpleScore,
	arrayScore
) {
		// use title and displayURL as the two keys to score
	const QuickScoreArray = arrayScore(quickScore, [
			{
				key: "title",
				score: quickScore
			},
			{
				key: "displayURL",
				score: function() {
						// add true to not discount spaces and capitals in the URL
					return quickScore.apply(null, Array.from(arguments).concat(true));
				}
			}
		]),
		SimpleScoreArray = arrayScore(simpleScore, ["title", "displayURL"]),
		MaxQueryLength = 25;


	return function scoreItems(
		items,
		query)
	{
		if (query.length <= MaxQueryLength) {
			return QuickScoreArray(items, query);
		} else {
			return SimpleScoreArray(items, query);
		}
	};
});
