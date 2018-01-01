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
	const QuickScoreArray = arrayScore(quickScore, ["title", "displayURL"]),
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
