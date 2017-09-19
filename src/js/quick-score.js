define(function() {
	const WhitespacePattern = /[-/:()<>%._=&\[\]\s]/,
		UpperCasePattern = /[A-Z]/,
		IgnoredScore = 0.9,
		SkippedScore = 0.15,
		LongStringLength = 151,
		MaxMatchStartPct = .15,
		MinMatchDensityPct = .5,
		BeginningOfStringPct = .1;


	function quickScore(
		string,
		query,
		hitMask)
	{
			// we use a Set for the hitMask so that indexes can only be added once
		var hitMaskSet = hitMask instanceof Array && new Set(),
			score = scoreForAbbreviation(string, query, hitMaskSet);

		if (hitMaskSet) {
			hitMask.length = 0;

				// convert the hitMask to an Array, which is easier to work with.
				// we have to sort it because the scorer may find a partial match
				// later in the string, and then not find the rest of the query,
				// so it starts over with a shorter piece of the query, which it
				// might find earlier in the string.  in that case, the hitMask
				// will have later indexes first, which we slice off so that the
				// hitMask has at most the same number of indices as the length
				// of the query, though this might still contain an extraneous
				// hit.   we have to sort the array with a function that correctly
				// sorts numbers, because JavaScript.  if the score is 0, force
				// the hitMask to be empty, since it could still have some
				// partial hits in it, and we don't want to highlight just parts
				// of the query in a result.
			Array.from(hitMaskSet).sort(compareNumbers).slice(0, string.length).forEach(function(index) {
				hitMask.push(index);
			});
		}

		return score;
	}


	function scoreForAbbreviation(
		itemString,
		abbreviation,
		hitMask,
		searchRange,
		abbreviationRange,
		fullMatchedRange)
	{
		searchRange = searchRange || new Range(0, itemString.length);
		abbreviationRange = abbreviationRange || new Range(0, abbreviation.length);
		fullMatchedRange = fullMatchedRange || new Range();

// TODO: why is the second test necessary?  !"" is true
		if (!abbreviation || !abbreviationRange.length) {
				// deduct some points for all remaining characters
			return IgnoredScore;
		}

		if (abbreviationRange.length > searchRange.length) {
			return 0;
		}

		for (var i = abbreviationRange.length; i > 0; i--) {
			var abbreviationSubstring = abbreviation.substr(abbreviationRange.location, i),
				matchedRange = rangeOfString(itemString, abbreviationSubstring, searchRange);

			if (!matchedRange.isValid()) {
				continue;
			}

// TODO: do we need this?  new code doesn't have it
			if (matchedRange.location + abbreviationRange.length > searchRange.max()) {
				continue;
			}

			if (!fullMatchedRange.isValid()) {
				fullMatchedRange.location = matchedRange.location;
			} else {
				fullMatchedRange.location = Math.min(fullMatchedRange.location, matchedRange.location);
			}

			fullMatchedRange.max(matchedRange.max());

			if (hitMask instanceof Set) {
				addIndexesInRange(hitMask, matchedRange);
			}

			var remainingSearchRange = new Range(matchedRange.max(), searchRange.max() - matchedRange.max()),
				remainingScore = scoreForAbbreviation(itemString, abbreviation, hitMask, remainingSearchRange,
					new Range(abbreviationRange.location + i, abbreviationRange.length - i),
					fullMatchedRange);

			if (remainingScore) {
				var score = remainingSearchRange.location - searchRange.location,
					matchStartPercentage = fullMatchedRange.location / itemString.length,
					useSkipReduction = itemString.length < LongStringLength ||
						matchStartPercentage < MaxMatchStartPct,
					matchStartDiscount = (1 - matchStartPercentage),
						// default to no match sparseness discount, for cases
						// where there are spaces before the matched letters or
						// they're capitals
					matchRangeDiscount = 1;

				if (matchedRange.location > searchRange.location) {
					var j;

						// some letters were skipped when finding this match, so
						// adjust the score based on whether spaces or capital
						// letters were skipped
					if (useSkipReduction && WhitespacePattern.test(itemString.charAt(matchedRange.location - 1))) {
						for (j = matchedRange.location - 2; j >= searchRange.location; j--) {
							if (WhitespacePattern.test(itemString.charAt(j))) {
								score--;
							} else {
// this reduces the penalty for skipped chars when we also didn't skip over any other words
								score -= SkippedScore;
							}
						}
					} else if (useSkipReduction && UpperCasePattern.test(itemString.charAt(matchedRange.location))) {
						for (j = matchedRange.location - 1; j >= searchRange.location; j--) {
							if (UpperCasePattern.test(itemString.charAt(j))) {
								score--;
							} else {
								score -= SkippedScore;
							}
						}
					} else {
							// reduce the score by the number of chars we've
							// skipped since the beginning of the search range
							// and discount the remainingScore based on how much
							// larger the match is than the abbreviation, unless
							// the match is in the first 10% of the string, the
							// match range isn't too sparse and the whole string
							// is not too long
						score -= matchedRange.location - searchRange.location;
						matchRangeDiscount = abbreviation.length / fullMatchedRange.length;
						matchRangeDiscount = (itemString.length < LongStringLength &&
							matchStartPercentage <= BeginningOfStringPct &&
							matchRangeDiscount >= MinMatchDensityPct) ? 1 : matchRangeDiscount;
					}
				}

					// discount the scores of very long strings
				score += remainingScore * Math.min(remainingSearchRange.length, LongStringLength) *
					matchRangeDiscount * matchStartDiscount;
				score /= searchRange.length;

				return score;
			}
		}

		return 0;
	}


	function Range(
		location,
		length)
	{
		if (typeof location == "undefined") {
			this.location = -1;
			this.length = 0;
		} else {
			this.location = location;
			this.length = length;
		}
	}


	Range.prototype.max = function(
		max)
	{
		if (typeof max == "number") {
			this.length = max - this.location;
		}

		return this.location + this.length;
	};


	Range.prototype.isValid = function()
	{
		return (this.location > -1);
	};


	Range.prototype.toString = function()
	{
		if (this.location == -1) {
			return "invalid range";
		} else {
			return "[" + this.location + "," + this.max() + ")";
		}
	};


	function rangeOfString(
		string,
		substring,
		searchRange)
	{
		searchRange = searchRange || new Range(0, string.length);

		var stringToSearch = string.substr(searchRange.location, searchRange.length).toLowerCase(),
			subStringIndex = stringToSearch.indexOf(substring.toLowerCase()),
			result = new Range();

		if (subStringIndex > -1) {
			result.location = subStringIndex + searchRange.location;
			result.length = substring.length;
		}

		return result;
	}


	function addIndexesInRange(
		indexes,
		range)
	{
		for (var i = range.location; i < range.max(); i++) {
			indexes.add(i);
		}

		return indexes;
	}


	function compareNumbers(
		a,
		b)
	{
		return a - b;
	}


	return quickScore;
});
