define(function() {
	var WhitespacePattern = /[-/:()<>%._=&\[\]\s]/,
		UpperCasePattern = /[A-Z]/;


	function scoreForAbbreviation(
		itemString,
		abbreviation,
		searchRange,
		abbreviationRange,
		hitMask)
	{
		searchRange = searchRange || new Range(0, itemString.length);
		abbreviationRange = abbreviationRange || new Range(0, abbreviation.length);

		if (!abbreviation || abbreviationRange.length > searchRange.length) {
			return 0;
		}

		if (!abbreviationRange.length) {
			return 0.9;
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

			if (hitMask) {
				addIndexesInRange(hitMask, matchedRange);
			}

			var remainingSearchRange = new Range(matchedRange.max(), searchRange.max() - matchedRange.max()),
				remainingScore = scoreForAbbreviation(itemString, abbreviation, remainingSearchRange,
					new Range(abbreviationRange.location + i, abbreviationRange.length - i), hitMask);

			if (remainingScore) {
				var score = remainingSearchRange.location - searchRange.location;

					// ignore skipped characters if it's first letter of a word
				if (matchedRange.location > searchRange.location) { //if some letters were skipped
					var j;

					if (WhitespacePattern.test(itemString.charAt(matchedRange.location - 1))) {
						for (j = matchedRange.location - 2; j >= searchRange.location; j--) {
							if (WhitespacePattern.test(itemString.charAt(j))) {
								score--;
							} else {
								score -= 0.15;
							}
						}
					} else if (UpperCasePattern.test(itemString.charAt(matchedRange.location))) {
						for (j = matchedRange.location - 1; j >= searchRange.location; j--) {
							if (UpperCasePattern.test(itemString.charAt(j))) {
								score--;
							} else {
								score -= 0.15;
							}
						}
					} else {
						score -= matchedRange.location - searchRange.location;
					}
				}

				score += remainingScore * remainingSearchRange.length;
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


	Range.prototype.max = function()
	{
		return this.location + this.length;
	};


	Range.prototype.isValid = function()
	{
		return (this.location > -1);
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
			indexes[i] = true;
		}

		return indexes;
	}


	return scoreForAbbreviation;
});
