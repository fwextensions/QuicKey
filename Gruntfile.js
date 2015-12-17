var _ = require("lodash");

module.exports = function(grunt)
{
	var baseConfig = {
//			mainConfigFile: "src/js/requireConfig-build.json",
//			mainConfigFile: "src/js/requireConfig.js",
			baseUrl: "src/js",
			paths: {
				"lodash": "lib/lodash",
				"stringScore": "lib/string_score",
				"react": "lib/react-shim",
				jquery: "../../build/jquery-2.1.1.min"
			},
//			optimize: "none",
			wrap: true,
			inlineText: true,
			preserveLicenseComments: true,
			name: "../../build/almond"
		},
		contentConfig = _.defaults({
			include: "content/main",
			out: "build/out/js/content/main.js"
		}, baseConfig),
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
			out: {
				cwd: "src/",
				expand: true,
				src: [
					"css/base.css",
					"img/**",
					"js/inject.js",
					"manifest.json"
				],
				dest: "build/out/"
			},
			crx: {
				src: "build/out.crx",
				dest: "release/Move, Dammit!.crx"
			}
		},

		sync: {
			out: {
				files: [
					{
						cwd: "src/",
						dest: "build/out/",
						src: [
							"css/base.css",
							"img/**",
							"js/inject.js",
							"js/bootstrap.js",
							"js/content/rte.js",
							"js/content/rte-paste.js",
							"manifest.json"
						]
					}
				],
				verbose: true
			},
			verbose: true
		},

		uglify: {
			rte: {
				files: [{
					expand: true,
					cwd: "src/js/content/",
					src: [
						"rte.js",
						"rte-paste.js"
					],
					dest: "build/out/js/content/"
				}]
			}
		},

		exec: {
			pack: {
				command: '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" ' +
					"--pack-extension=C:\\Projects\\Mail\\move-dammit\\build\\out " +
					'--pack-extension-key="C:\\Projects\\Mail\\move-dammit\\Move, Dammit!.pem"',
				callback: function()
				{
					grunt.task.run(["copy:crx"]);
				}
			}
		},

		compress: {
			main: {
				options: {
					archive: "release/Move, Dammit!.zip"
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
			content: { options: contentConfig }
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
		"uglify:rte",
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
