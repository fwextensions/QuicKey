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
			var abbreviationSubstring = abbreviation.substr(abbreviationRange.location, i);
			var matchedRange = rangeOfString(itemString, abbreviationSubstring, searchRange);

			if (!matchedRange.isValid()) {
				continue;
			}

			if (matchedRange.location + abbreviationRange.length > searchRange.max()) {
				continue;
			}

			if (hitMask) {
				addIndexesInRange(hitMask, matchedRange);
			}

			var remainingSearchRange = new Range(matchedRange.max(), searchRange.max() - matchedRange.max());
			var remainingScore = scoreForAbbreviation(itemString, abbreviation, remainingSearchRange,
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

		var stringToSearch = string.substr(searchRange.location, searchRange.length).toLowerCase();
		var subStringIndex = stringToSearch.indexOf(substring.toLowerCase());
		var result = new Range();

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
		for (var i = range.location; i < range.length; i++) {
			indexes[i] = true;
		}

		return indexes;
	}


	return scoreForAbbreviation;
});


/*

Usage:

[@"My Great Test String" scoreForAbbreviation:@"mgstr"];

--------------------------------------------------------------------------------


@implementation NSString (Abbreviation)

- (float) scoreForAbbreviation:(NSString *)abbreviation{
	return [[self | scoreForAbbreviation:abbreviation hitMask:nil ]];
}
- (float) scoreForAbbreviation:(NSString *)abbreviation hitMask:(NSMutableIndexSet *)mask{
	return [[self | scoreForAbbreviation:abbreviation inRange:NSMakeRange(0,[self length ]]) fromRange:NSMakeRange(0,[[abbreviation | length ]]) hitMask:mask];
}
- (float) scoreForAbbreviation:(NSString *)abbreviation inRange:(NSRange)searchRange fromRange:(NSRange)abbreviationRange hitMask:(NSMutableIndexSet *)mask{
    float score,remainingScore;
	int i,j;
	NSRange matchedRange,remainingSearchRange;
	if (!abbreviationRange.length) return 0.9; //deduct some points for all remaining letters
	if (abbreviationRange.length>searchRange.length)return 0.0;

//	 {
//		 matchedRange=[[self | rangeOfString:[abbreviation substringWithRange:NSMakeRange(abbreviationRange.location,1) ]]
//								  options:NSCaseInsensitiveSearch
//									range:searchRange];
//
//		 if (matchedRange.location=NSNotFound) return 0.9;
//		 searchRange.length-=matchedRange.location-searchRange.location;
//		 searchRange.location=matchedRange.location;
//	 }

	for (i=abbreviationRange.length; i>0;i--){ //Search for steadily smaller portions of the abbreviation
		matchedRange=[self rangeOfString:[abbreviation substringWithRange:NSMakeRange(abbreviationRange.location,i)]
					options:NSCaseInsensitiveSearch range:searchRange];

		if (NSNotFound == matchedRange.location) continue;
		if (matchedRange.location+abbreviationRange.length>NSMaxRange(searchRange)) continue;

		if (mask) [mask addIndexesInRange:matchedRange];

		remainingSearchRange.location=NSMaxRange(matchedRange);
		remainingSearchRange.length=NSMaxRange(searchRange)-remainingSearchRange.location;

		// Search what is left of the string with the rest of the abbreviation
		remainingScore = [self scoreForAbbreviation:abbreviation inRange:remainingSearchRange
					fromRange:NSMakeRange(abbreviationRange.location+i,abbreviationRange.length-i) hitMask:mask];

		if (remainingScore) {
			score = remainingSearchRange.location - searchRange.location;
			// ignore skipped characters if is first letter of a word
			if (matchedRange.location>searchRange.location){//if some letters were skipped
				j=0;
				if ([[NSCharacterSet whitespaceCharacterSet] characterIsMember: [self characterAtIndex: matchedRange.location-1]]) {
					for (j=matchedRange.location-2; j >= (int)searchRange.location; j--) {
						if ([[NSCharacterSet whitespaceCharacterSet] characterIsMember: [self characterAtIndex:j]]) score--;
						else score-=0.15;
					}

				} else if ([[NSCharacterSet uppercaseLetterCharacterSet] characterIsMember: [self characterAtIndex: matchedRange.location]]) {
					for (j=matchedRange.location-1; j >= (int)searchRange.location; j--) {
						if ([[NSCharacterSet uppercaseLetterCharacterSet] characterIsMember: [self characterAtIndex:j]])
							score--;
						else
							score-=0.15;
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

@end


 */
