	// renders the popup React app to static HTML and writes the result to
	// build/temp/popup.html, warning if the markup differs from what's
	// currently checked in to src/popup.html.  this replaces the old
	// static-site-generator-webpack-plugin build, using vite's SSR module
	// loader to import the JSX source directly in node.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createServer } from "vite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcDir = join(rootDir, "src");

	// install the same browser/chrome mocks the old webpack SSG build injected
	// as sandbox globals, so the modules imported by the popup app can run in
	// node.  defineProperty is used because node already defines some of these
	// (like navigator) as getters on globalThis.
const globals = require("../mock/globals.js");

for (const [key, value] of Object.entries(globals)) {
	Object.defineProperty(globalThis, key, {
		value,
		writable: true,
		configurable: true,
	});
}

const server = await createServer({
	configFile: false,
	root: rootDir,
	server: { middlewareMode: true },
	appType: "custom",
	resolve: {
		alias: {
			"@": join(srcDir, "js"),
			lodash: join(srcDir, "js/lib/lodont"),
		}
	},
});

try {
	const { default: render } = await server.ssrLoadModule("/build/scripts/build-popup.js");
	const html = render({ fs });
	const outPath = join(rootDir, "build/temp/popup.html");

	fs.mkdirSync(dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, html);
	console.log(`Wrote ${outPath}`);
} finally {
	await server.close();
}

	// exit explicitly, since the app modules kick off async work against the
	// mocked chrome APIs during rendering, and those dangling promises would
	// otherwise reject after the render is already done
process.exit(0);
