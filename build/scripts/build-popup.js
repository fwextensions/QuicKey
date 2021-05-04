const ReactDOMServer = require("react-dom/server");
const React = require("react");
const requirejs = require("requirejs");
const fs = require("fs");


const ConfigPattern = /({[\s\S]+})/m;
const RootPattern = /<div id="root">[^<]+(<.+)\s+/m;


const configFile = fs.readFileSync("./src/js/require-config.js", "utf8");
const currentPopupHTML = fs.readFileSync("./src/popup.html", "utf8");
const currentReactMarkup = currentPopupHTML.match(RootPattern)[1];
const match = configFile.match(ConfigPattern);


if (!match) {
	console.error("Error reading require-config.js");

	return "error";
}

	// create a fake navigator global, which init, shortcut-manager and constants
	// can check
navigator = {
	platform: "windows",
	languages: ["en-US"],
	userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36"
};

	// we have to wrap the bare object in parens to eval it
const config = eval("(" + match[1] + ")");

	// switch some of the libraries to mocked versions so that we can require
	// the App component outside of a browser
config.paths = Object.assign(config.paths, {
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
	const newReactMarkup = ReactDOMServer.renderToString(React.createElement(App, {
		initialQuery: "",
		initialShortcuts: [],
		platform: "win",
		tracker: {
			set: function() {}
		},
		port: {}
	}));

		// we only want to change the source file if the rendered markup has changed
	if (newReactMarkup !== currentReactMarkup) {
		const newPopupHTML = currentPopupHTML.replace(currentReactMarkup, newReactMarkup);

		fs.writeFileSync("./src/popup.html", newPopupHTML, "utf8");
		console.log("\n\n===== popup.html updated =====\n\n");
	} else {
		console.log("\n\n===== no update needed =====\n\n");
	}

		// force node to exit, since the new settings promises seem to cause
		// setState() outside of componentWillUnmount(), and React will complain
		// and there'll be some promise that hangs around until it times out
	process.exit();
});
