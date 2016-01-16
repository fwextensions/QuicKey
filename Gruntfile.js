module.exports = function(grunt)
{
	var baseConfig = {
			mainConfigFile: "src/js/require-config.js",
			baseUrl: "src/js",
				// specify the location of the main module
			include: "popup/main",
			out: "build/out/js/popup/main.js",
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
		devManifestPath = "src/manifest.json",
		buildManifestPath = "build/out/manifest.json";

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
				dest: "release/KeyTab.crx"
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
							"js/popup/init.js",
							"background.html",
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
					'--pack-extension-key="C:\\Projects\\Tools\\KeyTab\\keytab-extension\\KeyTab.pem"',
				callback: function()
				{
					grunt.task.run(["copy:crx"]);
				}
			}
		},

		compress: {
			main: {
				options: {
					archive: "release/KeyTab.zip"
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

		requirejs: {
			content: { options: baseConfig }
		}
	});

	grunt.loadNpmTasks("grunt-contrib-requirejs");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-contrib-compress");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-sync");
	grunt.loadNpmTasks("grunt-exec");

	grunt.registerTask("incrementVersion", function() {
		var manifest = grunt.file.readJSON(buildManifestPath),
			version = manifest.version.split("."),
			versionString;

		version[2] = parseInt(version[2]) + 1;
		versionString = version.join(".");
		manifest.version = versionString;
		grunt.file.write(buildManifestPath, JSON.stringify(manifest, null, "\t"));

		manifest = grunt.file.readJSON(devManifestPath);
		manifest.version = versionString;
		grunt.file.write(devManifestPath, JSON.stringify(manifest, null, "\t"));
	});

	grunt.registerTask("build", [
		"sync:out",
		"requirejs"
	]);

	grunt.registerTask("pack", [
		"build",
		"incrementVersion",
		"clean:out",
		"compress",
		"exec:pack"
	]);

	grunt.registerTask("default", [
		"build"
	]);
};
