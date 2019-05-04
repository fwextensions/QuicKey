module.exports = function(grunt)
{
	const extensionFullName = "QuicKey – The quick tab switcher";
	const extensionShortName = "QuicKey";
		// exclude the jsx plugin so the JSXTransformer isn't included
	const commonModules = [
		"jsx",
		"common/react",
		"common/base"
	];
	const modulesConfig = {
		mainConfigFile: "src/js/require-config.js",
		baseUrl: "src/js",
		dir: "build/rjs",
		skipDirOptimize: true,
		optimize: "none",
		wrap: false,
		inlineText: true,
		preserveLicenseComments: true,
		verbose: true,
		debug: true,
		modules: [
			{
				name: "common/react"
			},
			{
				name: "common/base"
			},
			{
				name: "popup/main",
				exclude: commonModules,
					// we have to include the require-config file, since it
					// maps the names used by ReactVirtualized for React and
					// ReactDOM to those used by the rest of the app, and
					// the optimizer doesn't include that map by default.
					// we only need that for the main module.
				include: ["require-config"]
			},
			{
				name: "background/background",
				exclude: commonModules
			},
			{
				name: "options/main",
				exclude: commonModules
			}
		],
		onBuildWrite: function(
			moduleName,
			path,
			singleContents) {
				// we're inlining the text and not including the text plugin,
				// since it's part of jsx, so get rid of the text! and jsx!
				// prefixes. otherwise, require will complain about not
				// finding the text or jsx modules.
			return singleContents.replace(/jsx!|text!/g, "");
		}
	};
	const devManifestPath = "src/manifest.json";
	const buildManifestPath = "build/out/manifest.json";
	const devPopupPath = "src/popup.html";
	const buildPopupPath = "build/out/popup.html";

	grunt.initConfig({
		verbose: true,

		clean: {
			out: [
				"build/out/out.crx",
				"release/*"
			],
			rjs: [
				"build/rjs"
			]
		},

		copy: {
			crx: {
				src: "build/out.crx",
				dest: "release/QuicKey.crx"
			}
		},

		sync: {
			out: {
				files: [
					{
						cwd: "src/",
						dest: "build/out/",
						src: [
							"css/*.css",
							"img/**",
							"manifest.json"
						]
					}
				]
			},
			build: {
				files: [
					{
						cwd: "build/rjs/",
						dest: "build/",
						src: [
							"build.txt"
						]
					}
				]
			}
		},

		exec: {
			pack: {
				command: '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" ' +
					"--pack-extension=C:\\Projects\\Tools\\KeyTab\\keytab-extension\\build\\out " +
					'--pack-extension-key="C:\\Projects\\Tools\\KeyTab\\keytab-extension\\QuicKey.pem"',
				callback: function()
				{
					grunt.task.run(["copy:crx"]);
				}
			}
		},

		compress: {
			main: {
				options: {
					archive: "release/QuicKey.zip"
				},
				files: [
					{
						expand: true,
						cwd: "build/out/",
						src: "**"
					}
				]
			}
		},

		babel: {
			options: {
				shouldPrintComment: (val) => /@license|@preserve|\/\*!/.test(val),
				comments: false,
				minified: true,
				compact: true,
				sourceMaps: false
			},
			rjs: {
				files: {
					"build/out/js/common/almond.js": "build/almond.js",
					"build/out/js/common/base.js": "build/rjs/common/base.js",
					"build/out/js/common/react.js": "build/rjs/common/react.js",
					"build/out/js/background/background.js": "build/rjs/background/background.js",
					"build/out/js/popup/init.js": "src/js/popup/init.js",
					"build/out/js/popup/main.js": "build/rjs/popup/main.js",
					"build/out/js/options/main.js": "build/rjs/options/main.js"
				}
			}
		},

		requirejs: {
			modulesConfig: {
				options: modulesConfig
			}
		}
	});

	// the lodash grunt task doesn't seem to work
	// node node_modules\lodash-cli\bin\lodash include=remove,escape,dropRightWhile,toPairs,memoize,pull exports=amd

	grunt.loadNpmTasks("grunt-contrib-requirejs");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-contrib-compress");
	grunt.loadNpmTasks("grunt-sync");
	grunt.loadNpmTasks("grunt-exec");
	grunt.loadNpmTasks("grunt-babel");

	grunt.registerTask("checkPopup", function() {
		const devPopup = grunt.file.read(devPopupPath);
		const devBody = devPopup.slice(devPopup.indexOf("<body>"));
		const buildPopup = grunt.file.read(buildPopupPath);
		const buildBody = buildPopup.slice(buildPopup.indexOf("<body>"));

		if (devBody !== buildBody) {
			grunt.fail.fatal("Source and build popup.html don't match:\n\nSource:\n" +
				devBody + "\n\nBuild:" + buildBody);
		}
	});

	grunt.registerTask("incrementVersion", function() {
		let manifest = grunt.file.readJSON(buildManifestPath);
		let version = manifest.version.split(".");
		let versionString;

		version[2] = parseInt(version[2]) + 1;
		versionString = version.join(".");
		manifest.version = versionString;

			// set the name back to the full name and icon tooltip that was
			// overridden in the cleanupManifest task
		manifest.name = extensionFullName;
		manifest.browser_action.default_title = extensionShortName;

		grunt.file.write(buildManifestPath, JSON.stringify(manifest, null, "\t"));

		manifest = grunt.file.readJSON(devManifestPath);
		manifest.version = versionString;
		grunt.file.write(devManifestPath, JSON.stringify(manifest, null, "\t"));
	});

	grunt.registerTask("cleanupManifest", function() {
		const manifest = grunt.file.readJSON(buildManifestPath);

			// we don't need the unsafe-eval policy in the built extension
		manifest.content_security_policy = manifest.content_security_policy.replace("'unsafe-eval' ", "");

		manifest.browser_action.default_title = manifest.name =
			extensionShortName + " OUT " + new Date().toLocaleString();

		grunt.file.write(buildManifestPath, JSON.stringify(manifest, null, "\t"));
	});

	grunt.registerTask("time", function() {
		console.log("Started at", new Date().toLocaleString());
	});

	grunt.registerTask("build", [
		"time",
		"sync:out",
		"cleanupManifest",
		"checkPopup",
		"requirejs",
		"babel",
		"sync:build",
		"clean:rjs"
	]);

	grunt.registerTask("pack", [
		"build",
		"incrementVersion",
		"clean:out",
		"compress"
	]);

	grunt.registerTask("pack-test", [
		"build",
		"compress"
	]);

	grunt.registerTask("default", [
		"build"
	]);
};
