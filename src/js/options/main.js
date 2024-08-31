import "@/lib/error-handler";
import React from "react";
import {createRoot} from "react-dom/client";
import {setup} from "goober";
import {shouldForwardProp} from "goober/should-forward-prop";
import stdout from "@/lib/stdout";
import OptionsAppContainer from "./app-container";

if (globalThis.DEBUG) {
	stdout("diohkfkdnhkijfjdjcmdbpemmapfgpgg");
}

setup(React.createElement, undefined, undefined,
	shouldForwardProp((prop) => !/left|right|top|bottom|width|height|tabWidth|navigating|enabled/.test(prop)));

createRoot(document.getElementById("root"))
	.render(React.createElement(OptionsAppContainer));
