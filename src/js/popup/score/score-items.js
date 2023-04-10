import quickScore from "./quick-score";
import simpleScore from "./simple-score";
import arrayScore from "./array-score";


	// use title and displayURL as the two keys to score by default
const DefaultKeys = [
	{
		key: "title",
		score: quickScore
	},
	{
		key: "displayURL",
		score: quickScore
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
const MaxAverageLength = 14;
const MaxQueryLength = 2 * MaxAverageLength;


function totalLength(
	strings)
{
	return strings.reduce((result, string) => result + string.length, 0);
}


export default function scoreItems(
	items,
	tokens,
	usePinyin)
{
	const queryLength = totalLength(tokens);
	const averageLength = queryLength / tokens.length;

	if (queryLength <= MaxQueryLength && averageLength <= MaxAverageLength) {
		if (usePinyin) {
			return PinyinQuickScoreArray(items, tokens);
		} else {
			return QuickScoreArray(items, tokens);
		}
	} else {
		return SimpleScoreArray(items, tokens);
	}
}
