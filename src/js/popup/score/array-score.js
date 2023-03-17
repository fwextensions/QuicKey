const SpacePattern = /\s+/;
const ReplacedStringLength = 100;
const ReplacedString = new Array(ReplacedStringLength).fill("*").join("");
// TODO: use a different replacement char


function getStringReplacement(
	length)
{
// TODO: support longer replacements
	return ReplacedString.slice(0, length);
}


function replaceRange(
	string,
	range)
{
	const start = range[0];
	const end = range[range.length - 1];

	return string.slice(0, start) + getStringReplacement(end - start) + string.slice(end);
}


function compareRanges(
	a,
	b)
{
	return a - b;
}


export default function(
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
				let string = item[key];
				let newScore = 0;

					// empty strings will get a score of 0
				if (string) {
						// trim any trailing space so that if the user typed one
						// word and then hit space, we'll turn that into just one
						// token, instead of the word plus an empty token
					const query = text.trim();
					const tokens = query.split(SpacePattern);

					if (tokens.length < 2) {
						newScore = score(string, query, hitMask);
					} else {
						for (const token of tokens) {
							const tokenMatches = [];
							const tokenScore = score(string, token, tokenMatches);

							if (tokenScore) {
								string = replaceRange(string, tokenMatches);
								hitMask.push(...tokenMatches);
								newScore += tokenScore;
							} else {
								newScore = 0;
								hitMask.length = 0;

								break;
							}
						}

						if (newScore) {
							hitMask.sort(compareRanges);
						}
					}
				}

				newScore *= (item.recentBoost || 1);
				item.scores[key] = newScore;
				item.hitMasks[key] = hitMask;

				return Math.max(currentScore, newScore);
			}, 0);
		});

		items.sort(compareScoredStrings);

		return items;
	}
}
