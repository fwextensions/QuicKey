	// orchestrates the three vite build passes that replace the old webpack
	// config:
	//   1. the popup and options pages, output as ES modules
	//   2. the background script, output as a self-contained iife so the
	//      service worker can load it via importScripts()
	//   3. the service worker itself, which must stay a classic script so it
	//      can register event listeners synchronously before pulling in the
	//      big background bundle
	// it also generates the production manifest.json and zips the output,
	// which used to be handled by webpack plugins.
	//
	// usage: node build/scripts/build.mjs [production|development] [--watch]
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import fs from "node:fs";
import { build } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { visualizer } from "rollup-plugin-visualizer";
import AdmZip from "adm-zip";
import babelJsx from "./babel-jsx.mjs";

const ShortName = "QuicKey";
const FullName = `${ShortName} – The quick tab switcher`;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcDir = join(rootDir, "src");
const mode = process.argv[2] === "development" ? "development" : "production";
const watch = process.argv.includes("--watch");
const isProduction = mode === "production";
const outDir = join(rootDir, isProduction ? "build/out" : "dist");
const buildTime = new Date().toISOString();

	// vite would normally empty outDir itself, but with three passes writing
	// to the same dir, only we know when it's safe to clean it
fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(join(rootDir, "build/temp"), { recursive: true, force: true });

function baseConfig()
{
	return {
		configFile: false,
		mode,
		root: srcDir,
		resolve: {
			alias: {
				"@": join(srcDir, "js"),
				lodash: join(srcDir, "js/lib/lodont"),
			}
		},
		plugins: [
			babelJsx(),
		],
		build: {
			outDir,
			emptyOutDir: false,
			target: "chrome119",
			sourcemap: !isProduction,
			minify: isProduction,
			watch: watch ? {} : null,
		},
			// silence "Module level directives cause errors when bundled"
			// style warnings from deps
		logLevel: "info",
	};
}

function pagesConfig()
{
	const config = baseConfig();

	config.plugins.push(
		{
			name: "quickey:build-time",
			transformIndexHtml(html)
			{
				return html.replace("__BUILD_TIME__", buildTime);
			}
		},
		viteStaticCopy({
			targets: [
					// images are also emitted by vite for the ones referenced
					// from html/css, but the manifest and runtime code expect
					// the whole directory at img/
				{ src: "img", dest: "." },
					// classic scripts loaded outside the module graph
				{ src: "js/lib/pinyin.js", dest: "." },
				{ src: "js/popup/init.js", dest: "." },
			],
			watch: { reloadPageOnChange: false },
		}),
		visualizer({
			filename: join(rootDir, "build/temp/report-pages.html"),
		}),
	);
	config.build.rollupOptions = {
		input: {
			popup: join(srcDir, "popup.html"),
			options: join(srcDir, "options.html"),
		},
		output: {
			entryFileNames: "js/[name].js",
			chunkFileNames: "js/[name]-[hash].js",
				// keep the css/ and img/ output layout the webpack build used
			assetFileNames({ names: [name] = [] })
			{
				if (name?.endsWith(".css")) {
					return "css/[name][extname]";
				}

				if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name ?? "")) {
					return "img/[name][extname]";
				}

				return "assets/[name][extname]";
			}
		}
	};
		// keep icons etc. as real files instead of inlined data URIs
	config.build.assetsInlineLimit = 0;

	return config;
}

function scriptConfig(
	entry,
	reportName)
{
	const config = baseConfig();

	config.plugins.push(
		visualizer({
			filename: join(rootDir, `build/temp/report-${reportName}.html`),
		}),
	);
	config.build.rollupOptions = {
		input: join(srcDir, entry),
		output: {
				// a single self-contained classic script, loadable via
				// importScripts().  it's built as one ES chunk wrapped in an
				// async iife, rather than format: "iife", because several
				// modules use top-level await, which rolldown can't emit in
				// iife format.  the wrapper makes those awaits legal and
				// matches how webpack's top-level-await runtime behaved: the
				// code after an await runs asynchronously, which is why sw.js
				// caches events until the background script finishes loading.
			format: "es",
			codeSplitting: false,
			entryFileNames: `js/${reportName}.js`,
			banner: "(async () => {",
			footer: "})();",
		}
	};

	return config;
}

function writeManifest()
{
	const manifest = JSON.parse(fs.readFileSync(join(srcDir, "manifest.json"), "utf8"));

	if (isProduction) {
			// update the manifest to use prod values
		manifest.name = FullName;
		manifest.short_name = ShortName;
		manifest.action.default_title = ShortName;
	}

		// in watch mode, the build promises resolve before the first build
		// finishes, so the output dir may not exist yet
	fs.mkdirSync(outDir, { recursive: true });
	fs.writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, "\t"));

	return manifest;
}

function zipOutput(
	manifest)
{
	const zipPath = join(rootDir, `release/${manifest.version}/${ShortName}.zip`);
	const zip = new AdmZip();

	fs.mkdirSync(dirname(zipPath), { recursive: true });
	zip.addLocalFolder(outDir);
	zip.writeZip(zipPath);
	console.log(`Created ${zipPath}`);
}

console.log(`Build mode: ${mode}${watch ? " (watch)" : ""} (${buildTime})`);

await build(pagesConfig());
await build(scriptConfig("js/background/background.js", "background"));
await build(scriptConfig("js/background/sw.js", "sw"));

const manifest = writeManifest();

if (isProduction && !watch) {
	zipOutput(manifest);
}
