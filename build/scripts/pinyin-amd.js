define(() => {
		// this is called within the browserify context which has a local
		// require(). so browserify will provide the pinyin node module, and
		// then define makes it available to requirejs modules.
	const originalPinyin = require("pinyin");
	const {STYLE_NORMAL, compare} = originalPinyin;


	function pinyin(
		string,
		convertToString = true)
	{
		let result = originalPinyin(string, {style: STYLE_NORMAL});

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
