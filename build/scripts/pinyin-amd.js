define([
	"pinyin"
], (
	originalPinyin
) => {
	const {STYLE_NORMAL, compare} = originalPinyin;


	function pinyin(
		string,
		convertToString = true,
		heteronym = true)
	{
		let result = originalPinyin(string, { style: STYLE_NORMAL, heteronym });

		if (convertToString) {
				// if there are multiple transliterations for a character,
				// include all of them with spaces in between, and then join
				// everything into one string
			result = result.map((chars) => chars.join(" ")).join(" ")
		}

		return result;
	}


	pinyin.compare = compare;

	return pinyin;
});
