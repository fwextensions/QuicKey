import React from "react";
import memoize from "fast-memoize";
import _ from "lodash";


	// memoize this, since it could get called multiple times by render() with
	// the same values, such as when the selection changes but the query doesn't
const wrapMatches = memoize((
		query,
		string,
		hitMask) =>
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
	}
);


export default function MatchedString(
	props)
{
	return <span
		data-score={props.score}
	>
		{wrapMatches(props.query, props.text, props.hitMask)}
	</span>
}
