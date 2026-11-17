	// this must be the first import, so its error listeners are added before
	// any other module code runs (it was a separate script tag under webpack)
import "@/lib/error-queue";
import "@/lib/error-handler";
import React from "react";
import {createRoot} from "react-dom/client";
import {setup} from "goober";
import {shouldForwardProp} from "goober/should-forward-prop";
import OptionsAppContainer from "./app-container";

setup(React.createElement, undefined, undefined,
	shouldForwardProp((prop) => !/left|right|top|bottom|width|height|tabWidth|navigating|enabled/.test(prop)));

createRoot(document.getElementById("root"))
	.render(React.createElement(OptionsAppContainer));
