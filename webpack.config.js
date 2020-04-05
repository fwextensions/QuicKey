module.exports = {
	mode: "production",
	performance: {
		hints: false
	},
	entry: "./build/scripts/pinyin-amd.js",
	output: {
		path: `${__dirname}/src/js/lib`,
		filename: "pinyin.js",
		libraryTarget: "amd"
	}
};
