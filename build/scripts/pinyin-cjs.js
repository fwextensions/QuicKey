	// this is called within the browserify context, which has a local require()
const originalPinyin = require("pinyin");
const {STYLE_NORMAL, compare} = originalPinyin;

	// this var is defined within the shim that gets wrapped around the output
	// of browserify, since calling define() in this file confused r.js for some
	// reason, so it couldn't find "lib/pinyin"
pinyin = (
	string,
	convertToString = true) =>
{
	let result = originalPinyin(string, {style: STYLE_NORMAL});

	if (convertToString) {
			// if there are multiple transliterations for a character, use
			// the first one and join all of them into one string
		result = result.map(([firstResult]) => firstResult).join(" ")
	}

	return result;
};

pinyin.compare = compare;
