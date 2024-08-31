const fs = require("fs");
const {join, resolve} = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const GenerateJsonPlugin = require("generate-json-webpack-plugin");
const ZipWebpackPlugin = require("zip-webpack-plugin");
const {BundleAnalyzerPlugin} = require("webpack-bundle-analyzer");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const SSGPlugin = require("static-site-generator-webpack-plugin");
const {getIfUtils, removeEmpty} = require("webpack-config-utils");
const manifest = require("./src/manifest.json");
const globals = require("./build/mock/globals");

const ShortName = "QuicKey";
const FullName = `${ShortName} – The quick tab switcher`;

module.exports = (env, argv) => {
	const {ifProduction, ifNotProduction, ifBuildPopup} = getIfUtils(env, ["production", "buildPopup"]);
	const outputPath = resolve(__dirname, ifProduction("build/out", "dist"));
	const mode = ifProduction("production", "development");
	const baseConfig = {
		mode,
		devtool: ifProduction(false, "source-map"),
		resolve: {
			alias: {
				"@": resolve(__dirname, "src/js"),
				lodash: resolve(__dirname, "src/js/lib/lodont"),
				cp: resolve(__dirname, "src/js/lib/cp"),
			}
		},
		module: {
			rules: [
				{
					test: /\.(js|jsx)$/,
					exclude: /node_modules/,
					use: ["babel-loader"]
				}
			]
		},
		stats: {
			builtAt: true,
		},
		performance: {
				// increase the limits so webpack doesn't spam the console with
				// complaints about the bundle sizes
			maxEntrypointSize: 500_000,
			maxAssetSize: 500_000,
		}
	};
	const output = {
		filename: "js/[name].js",
		path: outputPath,
		clean: true,
	};
	const buildTime = new Date().toISOString();

	const htmlOptions = (name) => ({
		template: `./src/${name}.html`,
		filename: `${name}.html`,
		chunks: ["error-queue", name],
		minify: false,
			// create a timestamp that's injected into an HTML comment via the plugins
		buildTime
	});

		// update the manifest to use prod values.  if we're in prod mode, this
		// version will be output below.
	manifest.name = FullName;
	manifest.short_name = ShortName;
	manifest.action.default_title = ShortName;
//	manifest.content_security_policy = manifest.content_security_policy.replace(" 'unsafe-eval'", "");

	console.log(`Build mode: ${mode} ${ifBuildPopup("buildPopup", "")} (${buildTime})`);

	return removeEmpty([
		{
			...baseConfig,
			entry: {
					// put this entry point first, so it gets loaded before the
					// main module on each page
				"error-queue": "./src/js/lib/error-queue.js",
				popup: "./src/js/popup/main.js",
				options: "./src/js/options/main.js",
				background: "./src/js/background/background.js",
				sw: "./src/js/background/sw.js",
			},
			plugins: removeEmpty([
				new CopyWebpackPlugin({
					patterns: removeEmpty([
						{ from: "src/css/", to: "css" },
						{ from: "src/img/", to: "img" },
						{ from: "src/js/lib/pinyin.js", to: "js/lib" },
						{ from: "src/js/popup/init.js", to: "js/popup" },
						ifNotProduction("src/manifest.json"),
					])
				}),
				new HtmlWebpackPlugin(htmlOptions("popup")),
				new HtmlWebpackPlugin(htmlOptions("options")),
				new CleanWebpackPlugin({
					cleanOnceBeforeBuildPatterns: removeEmpty([
						ifProduction(join(__dirname, "build/out/**")),
						join(__dirname, "build/temp/**"),
					]),
				}),
				new BundleAnalyzerPlugin({
					analyzerMode: "static",
					openAnalyzer: false,
					reportFilename: resolve(__dirname, "build/temp/report.html"),
				}),
				ifProduction(new GenerateJsonPlugin(
					"manifest.json",
					manifest,
					null,
					"\t"
				)),
				ifProduction(new ZipWebpackPlugin({
					path: join(__dirname, `release/${manifest.version}`),
					filename: `${ShortName}.zip`
				})),
			]),
			optimization: {
//				splitChunks: {
//					chunks: "all",
//				},
				minimize: ifProduction(true, false),
			},
			output
		},
		ifBuildPopup({
			...baseConfig,
			entry: {
					// output this bundle to build/temp/
				"../temp/ssg": "./build/scripts/build-popup.js",
			},
			plugins: [
				new SSGPlugin({
					entry: "../temp/ssg.js",
					paths: ["../temp/popup.html"],
						// pass the fs module to the render function, since it can't
						// seem to import that module on its own
					locals: { fs },
					globals,
				}),
			],
			output: {
				...output,
					// don't include the js/ path in the filename since the ssg
					// entry above includes a path
				filename: "[name].js",
				libraryTarget: "umd"
			}
		})
	]);
};
