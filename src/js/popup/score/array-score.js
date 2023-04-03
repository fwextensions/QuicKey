const SpacePattern = /\s+/;
const CharPattern = /./g;
	// use a NUL character to replace the matches so nothing in subsequent query
	// tokens will match an existing match
const ReplacementChar = "\x00";


function replaceMatches(
	string,
	matches)
{
	const start = matches[0];
	const end = matches[matches.length - 1];
	const replacementSection = string.slice(start, end + 1);
	const indexes = [...matches];
	let nextIndex = indexes.shift();

	return string.slice(0, start) +
		replacementSection.replace(CharPattern, (char, i) => {
			if (start + i === nextIndex) {
				nextIndex = indexes.shift();

				return ReplacementChar;
			} else {
				return char;
			}
		}) +
		string.slice(end + 1);
}


function compareMatches(
	a,
	b)
{
	return a - b;
}


function sumScores(
	tokenScores)
{
	let score = 0;

	for (const [, value] of tokenScores) {
		if (!value) {
			return 0;
		}

		score += value;
	}

	return score;
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
		if (a.score === b.score) {
			if (a.lastVisit && b.lastVisit) {
				return b.lastVisit - a.lastVisit;
			} else {
				return a[defaultKeyName].toLocaleLowerCase() < b[defaultKeyName].toLocaleLowerCase() ? -1 : 1;
			}
		} else {
			return b.score - a.score;
		}
	}


	function initItems(
		items)
	{
		if (items.length && !items[0].scores) {
			items.forEach(function(item) {
				item.score = 0;
				item.scores = {};
				item.hitMasks = {};
item.tokenScores = {};

				keys.forEach(({key}) => {
					item.scores[key] = 0;
					item.hitMasks[key] = [];
				});
			});
		}
	}


	function scoreSingleToken(
		items,
		query)
	{
		for (const item of items) {
				// find the highest score for each keyed string on this item
			item.score = keys.reduce((currentScore, {key, score}) => {
				const hitMask = [];
				const string = item[key];
					// score empty strings as 0
				const newScore = string
					? score(string, query, hitMask) * (item.recentBoost || 1)
					: 0;

				item.scores[key] = newScore;
				item.hitMasks[key] = hitMask;

				return Math.max(currentScore, newScore);
			}, 0);
		}
	}


	return function scoreArray(
		items,
		text)
	{
		initItems(items);

			// trim any trailing space so that if the user typed one
			// word and then hit space, we'll turn that into just one
			// token, instead of the word plus an empty token
		const tokens = text.trim().split(SpacePattern);

			// if the query is empty, the only thing we'll do is sort the items
			// array below, so it's alphabetized
		if (tokens.length === 1) {
				// use a simpler loop when there's just one token
			scoreSingleToken(items, tokens[0]);
		} else if (tokens.length > 1) {
			const defaultTokenScores = tokens.map((token) => [token, 0]);

			for (const item of items) {
					// init the map with 0 for each key, so we don't have to
					// handle missing keys in Math.max() below
				const tokenScores = new Map(defaultTokenScores);

				for (const { key, score } of keys) {
					const hitMask = [];
					let string = item[key];
					let keyScore = 0;

						// empty strings will get a score of 0
					if (string) {
						for (const token of tokens) {
							const tokenMatches = [];
							const tokenScore = score(string, token, tokenMatches);

							if (tokenScore) {
								string = replaceMatches(string, tokenMatches);
								hitMask.push(...tokenMatches);
								keyScore += tokenScore;
								tokenScores.set(token, Math.max(tokenScore, tokenScores.get(token)));
							}
						}

						if (keyScore) {
							hitMask.sort(compareMatches);
						}
					}

					item.scores[key] = keyScore;
					item.hitMasks[key] = hitMask;
item.tokenScores[key] = [...tokenScores];
				}

					// set the score to 0 if every token doesn't match at least
					// one of the keys
				item.score = sumScores(tokenScores) * (item.recentBoost ?? 1);
			}
		}

		items.sort(compareScoredStrings);

		return items;
	}
}
