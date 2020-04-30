module.exports = {
	mode: "production",
	optimization: {
			// when webpack minifies the function that returns the module, it
			// wraps it in parens for some reason, which confuses r.js, so just
			// let babel minify the file
		minimize: false
	},
	performance: {
		hints: false
	},
	entry: "./build/scripts/pinyin-amd.js",
	output: {
		path: `${__dirname}/src/js/lib`,
		filename: "pinyin.js",
		library: "pinyin"
	}
};
