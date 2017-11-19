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

	// we have to wrap the bare object in parens to eval it
config = eval("(" + match[1] + ")");

	// switch some of the libraries to mocked versions so that we can require
	// the App component outside of a browser
config.paths = _.assign(config.paths, {
	cp: "../../build/mock/cp",
	"check-modifiers": "../../build/mock/check-modifiers"
});

	// we're running in the top level directory, so add src to get to the
	// normal baseUrl that the app uses
config.baseUrl = "src" + config.baseUrl;

requirejs.config(config);

	// requirejs seems to run asynchronously and the paths get all weird running
	// this from grunt, so we have to run it as a plain node script and do the
	// writing of the rendered HTML inside the required module
requirejs([
	"jsx!popup/app",
], function(
	App
) {
	var html = ReactDOMServer.renderToString(React.createElement(App, {
			tabs: [],
			initialQuery: "",
			platform: "win"
		})),
			// insert the rendered HTML into the root node in the template
			// popup.html file
		newHTML = templateHTML.replace(Placeholder, html);

		// we only want to change the source file if the rendered markup has changed
	if (newHTML !== currentHTML) {
		fs.writeFileSync("./src/popup.html", newHTML, "utf8");
		console.log("popup.html updated");
	}
});
