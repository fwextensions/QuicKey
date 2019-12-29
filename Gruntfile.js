const fs = require("fs");
const merge = require("deepmerge");
const createWebstore = require("chrome-webstore-upload");


module.exports = function(grunt) {
	require("load-grunt-tasks")(grunt);


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
			singleContents)
		{
				// we're inlining the text and not including the text plugin,
				// since it's part of jsx, so get rid of the text! and jsx!
				// prefixes. otherwise, require will complain about not
				// finding the text or jsx modules.
			return singleContents.replace(/jsx!|text!/g, "");
		}
	};
	const buildManifestPath = "build/out/manifest.json";
	const devPopupPath = "src/popup.html";
	const prodPopupPath = "build/prod/popup.html";
	const outPopupPath = "build/out/popup.html";
	const extensionInfo = {
		quickey: {
			fullName: "QuicKey – The quick tab switcher",
			shortName: "QuicKey",
			extensionID: "ldlghkoiihaelfnggonhjnfiabmaficg",
			srcManifestPath: "src/manifest.json",
		},
		qktest: {
			fullName: "QK Test",
			shortName: "QK Test",
			extensionID: "ddbinmabfeaibekibbpbnblmkddlkhpo",
			srcManifestPath: "build/qktest-manifest.json",
		}
	};
	const config = {
		verbose: true,

		clean: {
			out: [
				"build/out/*",
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
			},
			quickey: {
				src: extensionInfo.quickey.srcManifestPath,
				dest: "build/out/manifest.json"
			},
			qktest: {
				src: extensionInfo.qktest.srcManifestPath,
				dest: "build/out/manifest.json"
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
					},
					{
						cwd: "build/prod/",
						dest: "build/out/",
						src: ["**"]
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
				callback: function() {
					grunt.task.run(["copy:crx"]);
				}
			}
		},

		compress: {
			quickey: {
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
			},
			qktest: {
				options: {
					archive: "release/QK Test.zip"
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

		confirm: {
			publish: {
				options: {
					question: function()
					{
						const target = this.args[0] || "quickey";
						const manifest = grunt.file.readJSON(extensionInfo[target].srcManifestPath);

						return `Publish v${manifest.version} of ${target}?  Type "${target}" to continue.\n`;
					},
					proceed: function(
						answer)
					{
						const target = this.args[0] || "quickey";

						return answer === target;
					}
				}
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
					"build/out/js/common/error-handler.js": "src/js/lib/error-handler.js",
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
	};
	const rootPattern = /<div id="root">[^<]+(<.+)\s+/m;
	const popupPlaceholder = "<!-- rendered html -->";

	grunt.initConfig(config);

	// the lodash grunt task doesn't seem to work
	// node node_modules\lodash-cli\bin\lodash include=remove,escape,dropRightWhile,toPairs,memoize,pull exports=amd

	grunt.registerTask("time", function() {
		console.log("Started at", new Date().toLocaleString());
	});

	grunt.registerTask("buildPopup", function() {
		const devPopup = grunt.file.read(devPopupPath);
		const devBody = devPopup.match(rootPattern)[1];
		const outPopup = grunt.file.read(prodPopupPath).replace(popupPlaceholder, devBody);

			// write out the built popup template with the latest React code
		grunt.file.write(outPopupPath, outPopup);
	});

	function updateManifest(
		path,
		...overrides)
	{
		let manifest = grunt.file.readJSON(path);

		manifest = merge.all([manifest, ...overrides]);
		grunt.file.write(path, JSON.stringify(manifest, null, "\t"));

		return manifest;
	}

	function incrementVersion(
		manifestPath)
	{
		const manifest = grunt.file.readJSON(manifestPath);
		const version = manifest.version.split(".");
		let versionString;

		version[2] = parseInt(version[2]) + 1;
		versionString = version.join(".");
		updateManifest(manifestPath, { version: versionString });

		return versionString;
	}

	grunt.registerTask("incrementVersion", function(target = "quickey") {
			// set the name back to the full name and icon tooltip that was
			// overridden in the cleanupManifest task
		const {srcManifestPath} = extensionInfo[target];
		const versionString = incrementVersion(buildManifestPath);

		updateManifest(srcManifestPath, { version: versionString });

		console.log(`Updated ${srcManifestPath} to version ${versionString}.`);
	});

	grunt.registerTask("cleanupManifest", function(target, env) {
		const manifest = grunt.file.readJSON(buildManifestPath);
		let {fullName, shortName} = extensionInfo[target];

		if (env == "dev") {
			fullName = shortName = `${manifest.short_name} BUILD ${new Date().toLocaleString()}`;
		}

		updateManifest(buildManifestPath,
			{
					// we don't need the unsafe-eval policy in the built extension
				content_security_policy: manifest.content_security_policy.replace("'unsafe-eval' ", ""),
				name: fullName,
				browser_action: {
					default_title: shortName
				}
			});
	});

	function publish(
		extensionID,
		zipStream)
	{
		const clientInfo = grunt.file.readJSON("keys/client.json");
		const refreshInfo = grunt.file.readJSON("keys/refresh-token.json");
		const webstore = createWebstore({
			extensionId: extensionID,
			clientId: clientInfo.installed.client_id,
			clientSecret: clientInfo.installed.client_secret,
			refreshToken: refreshInfo.refresh_token
		});

		return webstore.fetchToken()
			.then(token => {
				console.log(`Fetched webstore token (${token}).`);

				return webstore.uploadExisting(zipStream, token)
					.then((response) => {
						if (response.uploadState == "SUCCESS") {
							console.log(`Extension uploaded (${extensionID}).`);

							return webstore.publish("default", token)
								.then(({statusDetail}) => console.log(`Publish status: ${statusDetail}`));
						} else {
							console.error(response);
						}
					});
			})
			.catch(console.error);
	}

	grunt.registerTask("upload", function(target = "quickey") {
		const done = this.async();
		const zipStream = fs.createReadStream(config.compress[target].options.archive);
		const extensionID = extensionInfo[target].extensionID;

		publish(extensionID, zipStream)
			.then(done);
	});

	grunt.registerTask("build", function(target = "quickey", env = "dev") {
		grunt.task.run([
			"time",
			"sync:out",
			`copy:${target}`,
			`cleanupManifest:${target}:${env}`,
			"buildPopup",
			"requirejs",
			"babel",
			"sync:build",
			"clean:rjs"
		]);
	});

	grunt.registerTask("pack", function(target = "quickey", test) {
		const tasks = [
			"clean:out",
			`build:${target}:prod`,
		];

			// increment the version in the manifest only if this isn't a test
		if (test !== "test") {
			tasks.push("incrementVersion");
		}

		tasks.push("compress:" + target);
		grunt.task.run(tasks);
	});

	grunt.registerTask("publish", function(target = "quickey") {
		grunt.task.run([
			"pack:" + target,
			"confirm:publish:" + target,
			"upload:" + target
		]);
	});

	grunt.registerTask("default", [
		"build"
	]);
};
