import React from "react";
import * as ReactDOMServer from "react-dom/server";
import App from "@/popup/app";

	// make the text red using escape codes
const ChangeWarning = ["\x1b[31m%s\x1b[0m", `

================================

    Popup markup has changed

================================

`];
const root = (contents) => `<div id="root">${contents}</div>`;
const rootPattern = new RegExp(root("(.+)"));

export default function render({ fs })
{
	const currentPopupHTML = fs.readFileSync("./src/popup.html", "utf8");
	const match = currentPopupHTML.match(rootPattern);
	const currentReactMarkup = match[1];
	const newReactMarkup = ReactDOMServer.renderToString(React.createElement(App, {
		initialQuery: "",
		initialShortcuts: [],
		platform: "win",
		tracker: {
			set: function() {}
		},
		port: {}
	}));

	if (currentReactMarkup !== newReactMarkup) {
		console.log(...ChangeWarning);
	}

	return currentPopupHTML.replace(root(currentReactMarkup), root(newReactMarkup));
};
