import { search } from "@/popup/score/search";


function simpleScore(
	string,
	query,
	hitMask)
{
	const index = search(string, query);
	const stringLength = string.length;
	const queryLength = query.length;
	let score = 0;

	if (index > -1) {
		score = ((stringLength - index) / stringLength) * (queryLength / stringLength);

		for (let i = index, len = index + queryLength; i < len; i++) {
			hitMask.push(i);
		}
	}

	return score;
}


export default simpleScore;
