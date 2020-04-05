define([
	"pinyin"
], (
	originalPinyin
) => {
	const {STYLE_NORMAL, compare} = originalPinyin;


	function pinyin(
		string,
		convertToString = true)
	{
		let result = originalPinyin(string, { style: STYLE_NORMAL });

		if (convertToString) {
				// if there are multiple transliterations for a character, use
				// the first one and join all of them into one string
			result = result.map(([firstResult]) => firstResult).join(" ")
		}

		return result;
	}


	pinyin.compare = compare;

	return pinyin;
});
