define([
	"./quick-score",
	"./simple-score",
	"./array-score"
], function(
	quickScore,
	simpleScore,
	arrayScore
) {
		// use title and displayURL as the two keys to score by default
	const DefaultKeys = [
		{
			key: "title",
			score: quickScore
		},
		{
			key: "displayURL",
			score: function(
				itemString,
				abbreviation,
				hitMask)
			{
					// add true to not give a higher score to matches after
					// spaces or on capitals in the URL
				return quickScore(itemString, abbreviation, hitMask, true);
			}
		}
	];
	const PinyinKeys = DefaultKeys.concat([
		{
			key: "pinyinTitle",
			score: quickScore
		},
		{
			key: "pinyinDisplayURL",
			score: DefaultKeys[1].score
		}
	]);
	const QuickScoreArray = arrayScore(quickScore, DefaultKeys);
	const PinyinQuickScoreArray = arrayScore(quickScore, PinyinKeys);
	const SimpleScoreArray = arrayScore(simpleScore, DefaultKeys.map(({key}) => key));
	const MaxQueryLength = 25;


	return function scoreItems(
		items,
		query,
		usePinyin)
	{
		if (query.length <= MaxQueryLength) {
			if (usePinyin) {
				return PinyinQuickScoreArray(items, query);
			} else {
				return QuickScoreArray(items, query);
			}
		} else {
			return SimpleScoreArray(items, query);
		}
	};
});
