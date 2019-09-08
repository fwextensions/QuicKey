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
	const wrapMatches = _.memoize(function(
		query,
		string,
		hitMask)
	{
		const substrings = [];

		for (let i = 0, len = hitMask.length; i < len; i++) {
			const hitIndex = hitMask[i];
			const prefix = string.slice((hitMask[i - 1] + 1) || 0, hitIndex);
			const boldChar = string[hitIndex];

				// check that prefix isn't empty, so we don't push empty spans
			prefix && substrings.push(<span>{prefix}</span>);
			boldChar && substrings.push(<b>{boldChar}</b>);
		}

		const remainder = string.slice(_.last(hitMask) + 1);

			// add the part of the string after the last char match.  if the
			// hit mask is empty, slice(NaN) will return the whole string.
		remainder && substrings.push(<span>{remainder}</span>);

		return React.Children.toArray(substrings);
	}, function(query, string) {
			// by default, memoize uses just the first arg as a key, but that's the
			// same for all titles/urls.  so combine them to generate something unique.
		return query + string;
	});


	return function MatchedString(
		props)
	{
		return <span
			data-score={props.score}
		>
			{wrapMatches(props.query, props.text, props.hitMask)}
		</span>
	}
});
