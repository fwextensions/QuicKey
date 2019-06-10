const ReactDOMServer = require("react-dom/server"),
	React = require("react"),
	requirejs = require("requirejs"),
	fs = require("fs"),
	_ = require("lodash");


const ConfigPattern = /(\{[\s\S]+\})/m,
	Placeholder = "<!-- rendered html -->";


var configFile = fs.readFileSync("./src/js/require-config.js", "utf8"),
	currentHTML = fs.readFileSync("./src/popup.html", "utf8"),
	templateHTML = fs.readFileSync("./build/mock/popup.html", "utf8"),
	match = configFile.match(ConfigPattern),
	config;


if (!match) {
	console.error("Error reading require-config.js");

	return "error";
}

	// create a fake navigator global, which init and shortcut-manager can check
navigator = {
	platform: "windows"
};

	// we have to wrap the bare object in parens to eval it
config = eval("(" + match[1] + ")");

	// switch some of the libraries to mocked versions so that we can require
	// the App component outside of a browser
config.paths = _.assign(config.paths, {
	cp: "../../build/mock/cp",
		// the mock tracker needs to create a window global and then require
		// the original tracker module
	"original-tracker": "background/tracker",
	"background/tracker": "../../build/mock/tracker"
});

	// we're running in the top level directory, so add src to get to the
	// normal baseUrl that the app uses
config.baseUrl = "src" + config.baseUrl;

requirejs.config(config);

	// requirejs seems to run asynchronously and the paths get all weird running
	// this from grunt, so we have to run it as a plain node script and do the
	// writing of the rendered HTML inside the required module
requirejs([
	"jsx!popup/app"
], function(
	App
) {
	const html = ReactDOMServer.renderToString(React.createElement(App, {
		initialQuery: "",
		initialShortcuts: [],
		platform: "win",
		tracker: {
			set: function() {
			}
		},
		port: {}
	}));
		// insert the rendered HTML into the root node in the template
		// popup.html file
	const newHTML = templateHTML.replace(Placeholder, html);


		// we only want to change the source file if the rendered markup has changed
	if (newHTML !== currentHTML) {
		console.log("\n\n===== popup.html updated =====\n\n");
		fs.writeFileSync("./src/popup.html", newHTML, "utf8");
	} else {
		console.log("\n\n===== no update needed =====\n\n");
	}

		// force node to exit, since the new settings promises seem to cause
		// setState() outside of componentWillUnmount(), and React will complain
		// and there'll be some promise that hangs around until it times out
	process.exit();
});
