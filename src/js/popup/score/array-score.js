const CharPattern = /./g;
	// use a NUL character to replace the matches so nothing in subsequent query
	// tokens will match an existing match
const ReplacementChar = "\x00";


const numerically = (a, b) => a - b;


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


function sumScores(
	tokenScores)
{
	let total = 0;

	for (const score of tokenScores) {
		if (!score) {
			return 0;
		}

		total += score;
	}

	return total;
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
		tokens)
	{
		initItems(items);

			// if the query is empty, the only thing we'll do is sort the items
			// array below, so it's alphabetized
		if (tokens.length === 1) {
				// use a simpler loop when there's just one token
			scoreSingleToken(items, tokens[0]);
		} else if (tokens.length > 1) {
			for (const item of items) {
					// init the map with 0 for each key, so we don't have to
					// handle missing keys in Math.max() below
				const tokenScores = new Array(tokens.length).fill(0);

				for (const { key, score } of keys) {
					const hitMask = [];
					let string = item[key];
					let keyScore = 0;

						// empty strings will get a score of 0
					if (string) {
						for (let i = 0, len = tokens.length; i < len; i++) {
							const token = tokens[i];
							const tokenMatches = [];
							const tokenScore = score(string, token, tokenMatches);

							if (tokenScore) {
								string = replaceMatches(string, tokenMatches);
								hitMask.push(...tokenMatches);
								keyScore += tokenScore;
								tokenScores[i] = Math.max(tokenScore, tokenScores[i]);
							}
						}

						if (keyScore) {
							hitMask.sort(numerically);
						}
					}

					item.scores[key] = keyScore;
					item.hitMasks[key] = hitMask;
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
