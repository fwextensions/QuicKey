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

const ShortName = "QuicKey";
const FullName = `${ShortName} – The quick tab switcher`;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcDir = join(rootDir, "src");
const mode = process.argv[2] === "development" ? "development" : "production";
const watch = process.argv.includes("--watch");
const isProduction = mode === "production";
	// both builds land under dist/, so build/ holds only the scripts that
	// produce them.  they're kept in separate directories so that building for
	// production doesn't wipe out the development build that's currently loaded
	// unpacked in Chrome -- the two differ in minification, sourcemaps and
	// manifest name.  it's dist/prod rather than the zip in release/ that gets
	// loaded unpacked when checking a production build.
const outDir = join(rootDir, isProduction ? "dist/prod" : "dist/dev");
const tempDir = join(rootDir, "dist/temp");

	// this has to be recalculated for each pass, rather than stamped once when
	// the script starts, so that a watch rebuild shows when it actually
	// happened.  that's how you can tell whether the build loaded in Chrome
	// includes the latest edit.
function buildTime()
{
	return new Date().toLocaleString();
}

	// vite would normally empty outDir itself, but with three passes writing
	// to the same dir, only we know when it's safe to clean it
fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(tempDir, { recursive: true, force: true });

	// some files are copied to outDir verbatim rather than being imported by
	// anything: src/public/ holds the classic scripts that have to stay
	// outside the module graph, like popup/init.js, and src/img/ is copied
	// wholesale by viteStaticCopy.  since they're not in any module graph,
	// rollup would never notice an edit, so watch them explicitly to make
	// `npm run dev` rebuild (and re-copy) when one of them changes.  the
	// directories themselves are watched too, so added or deleted files
	// trigger a rebuild as well.
function watchCopiedFiles()
{
	const dirs = [join(srcDir, "public"), join(srcDir, "img")];

	return {
		name: "quickey:watch-copied-files",
		buildStart()
		{
			const walk = (dir) => {
				this.addWatchFile(dir);

				for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
					const path = join(dir, entry.name);

					if (entry.isDirectory()) {
						walk(path);
					} else {
						this.addWatchFile(path);
					}
				}
			};

			dirs.filter(fs.existsSync).forEach(walk);
		}
	};
}


	// vite reports how long each pass took, but not when it finished.  rewrite
	// the manifest here as well as logging, since closeBundle fires after
	// every watch rebuild, whereas the build() promises resolve as soon as the
	// watcher is set up, before the first build has even finished.  writing it
	// from each pass means the manifest's Built: time keeps up with whichever
	// passes a given edit triggered.
function finishBuild(
	name)
{
	return {
		name: "quickey:finish-build",
		closeBundle()
		{
			writeManifest();
			console.log(`${name} built at ${new Date().toLocaleTimeString()}`);
		}
	};
}

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
		plugins: [],
		build: {
			outDir,
			emptyOutDir: false,
			target: "chrome119",
			sourcemap: !isProduction,
			minify: isProduction,
			watch: watch ? {} : null,
				// modulepreload is a hint for hiding network latency, and there
				// is none here -- every chunk is a local file inside the
				// extension.  it also produced a console warning on every popup
				// open ("preloaded using link preload but not used within a few
				// seconds"), since the popup page can be moved between windows
				// and hidden immediately after loading, which leaves the
				// preloaded chunk unclaimed.
			modulePreload: false,
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
				return html.replace("__BUILD_TIME__", buildTime());
			}
		},
		viteStaticCopy({
			targets: [
					// images are also emitted by vite for the ones referenced
					// from html/css, but the manifest and runtime code expect
					// the whole directory at img/
				{ src: "img", dest: "." },
					// classic script loaded outside the module graph
				{ src: "js/lib/pinyin.js", dest: "." },
			],
			watch: { reloadPageOnChange: false },
		}),
		watchCopiedFiles(),
		visualizer({
			filename: join(tempDir, "report-pages.html"),
		}),
		finishBuild("pages"),
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

		// only the pages build needs to copy src/public/ to outDir
	config.publicDir = false;
	config.plugins.push(
		visualizer({
			filename: join(tempDir, `report-${reportName}.html`),
		}),
		finishBuild(reportName),
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
	} else {
			// newlines are ignored when the description is shown in the Extensions
			// tab, so force a wrap with the dashes
		manifest.description = `Built: ${buildTime()}\n————————\n${manifest.description}`
	}

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

console.log(`Build mode: ${mode}${watch ? " (watch)" : ""} (${buildTime()})`);

	// each pass writes the manifest as it finishes, so there's nothing left to
	// do here but zip up what they produced
await build(pagesConfig());
await build(scriptConfig("js/background/background.js", "background"));
await build(scriptConfig("js/background/sw.js", "sw"));

if (isProduction && !watch) {
	zipOutput(JSON.parse(fs.readFileSync(join(outDir, "manifest.json"), "utf8")));
}
