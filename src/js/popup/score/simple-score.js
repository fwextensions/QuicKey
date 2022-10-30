
	function simpleScore(
		string,
		query,
		hitMask)
	{
		var index = string.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()),
			stringLength = string.length,
			queryLength = query.length,
			score = 0;

		if (index > -1) {
			score = ((stringLength - index) / stringLength) * (queryLength / stringLength);

			for (var i = index; i < index + queryLength; i++) {
				hitMask.push(i);
			}
		}

		return score;
	}


	export default simpleScore;

