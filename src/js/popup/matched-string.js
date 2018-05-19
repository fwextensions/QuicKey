define([
		// we need react here even if we're not explicitly referencing it so
		// that the converted JSX can use it
	"react",
	"lodash"
], function(
	React,
	_
) {
		// memoize this, since it could get called multiple times by render() with
		// the same values, such as when the selection changes but the query doesn't
	var wrapMatches = _.memoize(function(
		query,
		string,
		hitMask)
	{
		var substrings,
			wrappedString;

		if (!query) {
				// in the case of an empty query, we still have to escape the
				// full string, since it could contain angle brackets and we use
				// dangerouslySetInnerHTML below
			wrappedString = _.escape(string);
		} else {
			substrings = hitMask.map(function(hitIndex, i) {
						// escape the part before the bold char, so that any brackets
						// in the title or URL don't get interpreted
					var prefix = _.escape(string.slice((hitMask[i - 1] + 1) || 0, hitIndex)),
						boldChar = string[hitIndex] && "<b>" + string[hitIndex] + "</b>";

						// use an empty string if didn't find the boldChar, so we
						// don't append "undefined"
					return prefix + (boldChar || "");
				});

				// add the part of the string after the last char match.  if the
				// hit mask is empty, slice(NaN) will return the whole string.
			substrings.push(_.escape(string.slice(_.last(hitMask) + 1)));
			wrappedString = substrings.join("");
		}

		return wrappedString;
	}, function(query, string) {
			// by default, memoize uses just the first arg as a key, but that's the
			// same for all titles/urls.  so combine them to generate something unique.
		return query + string;
	});


	return function MatchedString(
		props)
	{
		var html = wrapMatches(props.query, props.text, props.hitMask);

			// the html has been escaped by wrapMatches()
		return <div
			className={props.className}
			data-score={props.score}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	}
});
