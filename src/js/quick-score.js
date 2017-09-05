define(function() {
	const WhitespacePattern = /[-/:()<>%._=&\[\]\s]/,
		UpperCasePattern = /[A-Z]/,
		LongStringLength = 101,
		MaxMatchStartPct = .3,
		MinMatchDensityPct = .5,
		BeginningOfStringPct = .1;


	function scoreForAbbreviation(
		itemString,
		abbreviation,
		hitMask,
		searchRange,
		abbreviationRange,
		originalAbbreviation,
		fullMatchedRange)
	{
		searchRange = searchRange || new Range(0, itemString.length);
		abbreviationRange = abbreviationRange || new Range(0, abbreviation.length);
		originalAbbreviation = originalAbbreviation || abbreviation;
		fullMatchedRange = fullMatchedRange || new Range();

		if (!abbreviation || !abbreviationRange.length) {
			return 0.9;
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

			if (hitMask) {
				addIndexesInRange(hitMask, matchedRange);
			}

			var remainingSearchRange = new Range(matchedRange.max(), searchRange.max() - matchedRange.max()),
				remainingScore = scoreForAbbreviation(itemString, abbreviation, hitMask, remainingSearchRange,
					new Range(abbreviationRange.location + i, abbreviationRange.length - i),
					originalAbbreviation, fullMatchedRange);

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
								score -= 0.15;
							}
						}
					} else if (useSkipReduction && UpperCasePattern.test(itemString.charAt(matchedRange.location))) {
						for (j = matchedRange.location - 1; j >= searchRange.location; j--) {
							if (UpperCasePattern.test(itemString.charAt(j))) {
								score--;
							} else {
								score -= 0.15;
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
						matchRangeDiscount = originalAbbreviation.length / fullMatchedRange.length;
						matchRangeDiscount = (itemString.length < LongStringLength &&
							matchStartPercentage <= BeginningOfStringPct &&
							matchRangeDiscount >= MinMatchDensityPct) ? 1 : matchRangeDiscount;
					}
				}

				score += remainingScore * remainingSearchRange.length *
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
			indexes.push(i);
		}

		return indexes;
	}


	return scoreForAbbreviation;
});
