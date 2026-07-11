import { defineConfig } from "vitest/config";
import { resolve } from "path";

	// mirror the module aliases from webpack.config.js so the source imports
	// resolve the same way under test.  note that lodash points at the trimmed
	// "lodont" shim and cp at the local promise wrapper, exactly as in the build.
export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "src/js"),
			lodash: resolve(__dirname, "src/js/lib/lodont"),
			cp: resolve(__dirname, "src/js/lib/cp"),
		},
	},
	test: {
		environment: "node",
		globals: true,
			// setup.js installs the chrome / navigator / locks fakes as globals
			// and mocks the analytics trackers before any source module loads
		setupFiles: ["./test/setup.js"],
		include: ["test/**/*.test.js"],
			// isolate each test file so the source module graph (and its
			// import-time state, like the constants evaluated from navigator)
			// is re-created fresh per file
		isolate: true,
	},
});
