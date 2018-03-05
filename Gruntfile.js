const _ = require("lodash");


module.exports = function(grunt)
{
	var extensionFullName = "QuicKey – The quick tab switcher",
		extensionShortName = "QuicKey",
		baseConfig = {
			mainConfigFile: "src/js/require-config.js",
			baseUrl: "src/js",
				// make sure the jsx plugin is excluded, so the JSXTransformer
				// isn't included
			exclude: ["jsx"],
//			optimize: "none",
			wrap: true,
			inlineText: true,
			preserveLicenseComments: true,
			name: "../../build/almond",
			onBuildWrite: function (moduleName, path, singleContents)
			{
					// we're inlining the text and not including the text plugin,
					// since it's part of jsx, so get rid of the text! and jsx!
					// prefixes. otherwise, require will complain about not
					// finding the text module.
				return singleContents.replace(/jsx!|text!/g, "");
			}
		},
		popupConfig = _.defaults({}, baseConfig, {
				// specify the location of the main module.  we also have to
				// include the require-config file, since it maps the names
				// used by ReactVirtualized for React and ReactDOM to those
				// used by the rest of the app, and the optimizer doesn't include
				// that map by default.
			include: ["require-config", "popup/main"],
			out: "build/out/js/popup/main.js"
		}),
		backgroundConfig = _.defaults({}, baseConfig, {
			include: ["require-config", "background/background"],
			out: "build/out/js/background/background.js"
		}),
		optionsConfig = _.defaults({}, baseConfig, {
			include: ["require-config", "options/options"],
			out: "build/out/js/options/options.js"
		}),
		devManifestPath = "src/manifest.json",
		buildManifestPath = "build/out/manifest.json",
		devPopupPath = "src/popup.html",
		buildPopupPath = "build/out/popup.html";

	grunt.initConfig({
		verbose: true,

		clean: {
			out: [
				"build/out/out.crx",
				"release/*"
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
							"options.html",
							"manifest.json"
						]
					}
				],
				verbose: true
			},
			verbose: true
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

		uglify: {
			init: {
				files: {
					"build/out/js/popup/init.js": ["src/js/popup/init.js"]
				}
			}
		},

		requirejs: {
			popup: { options: popupConfig },
			background: { options: backgroundConfig },
				// annoyingly, just calling this "options" doesn't work
			optionsDialog: { options: optionsConfig }
		}
	});

	// the lodash grunt task doesn't seem to work
	// node node_modules\lodash-cli\bin\lodash include=remove,escape,dropRightWhile,toPairs,memoize,pull exports=amd

	grunt.loadNpmTasks("grunt-contrib-requirejs");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-contrib-compress");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-sync");
	grunt.loadNpmTasks("grunt-exec");

	grunt.registerTask("checkPopup", function() {
		var devPopup = grunt.file.read(devPopupPath),
			devBody = devPopup.slice(devPopup.indexOf("<body>")),
			buildPopup = grunt.file.read(buildPopupPath),
			buildBody = buildPopup.slice(buildPopup.indexOf("<body>"));

		if (devBody !== buildBody) {
			grunt.fail.fatal("Source and build popup.html don't match:\n\nSource:\n" +
				devBody + "\n\nBuild:" + buildBody);
		}
	});

	grunt.registerTask("incrementVersion", function() {
		var manifest = grunt.file.readJSON(buildManifestPath),
			version = manifest.version.split("."),
			versionString;

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
		var manifest = grunt.file.readJSON(buildManifestPath);

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
		"uglify"
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
