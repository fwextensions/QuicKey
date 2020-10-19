const webpack = require("webpack");


const JSXLoaderPattern = /^jsx!/;


module.exports = {
	mode: "production",
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: ["babel-loader"]
			}
		]
	},
	resolve: {
		modules: ["src/js", "node_modules"],
		extensions: ["*", ".js", ".jsx"],
		alias: {
			react: "lib/react.min",
			"react-dom": "lib/react-dom.min",
			ReactDOM: "lib/react-dom.min",
			jsx: "lib/jsx",
			text: "lib/text",
			JSXTransformer: "lib/JSXTransformer",
			"react-virtualized": "lib/react-virtualized",
			lodash: "lib/lodash",
			cp: "lib/cp",
			shared: "lib/shared",
			bluebird: "lib/bluebird.core.min"
		}
	},
	plugins: [
			// strip out the jsx! plugin from all the component paths, since
			// babel will transpile those
		new webpack.NormalModuleReplacementPlugin(
			JSXLoaderPattern,
			res => res.request = res.request.replace(JSXLoaderPattern, "")
		)
	],
//	performance: {
//		hints: false
//	},
	entry: {
		background: "./src/js/background/background.js",
		popup: "./src/js/popup/main.js",
		options: "./src/js/options/main.js",
//		pinyin: "./build/scripts/pinyin-amd.js"
	},
	output: {
		path: `${__dirname}/build/out/js`,
	}
//	output: {
//		path: `${__dirname}/src/js/lib`,
//		filename: "pinyin.js",
//		library: "pinyin"
//	}
};
