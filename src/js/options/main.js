import React from "react";
import {createRoot} from "react-dom/client";
import {setup} from "goober";
import { shouldForwardProp } from "goober/should-forward-prop";
import OptionsAppContainer from "./app-container";

setup(React.createElement, undefined, undefined, shouldForwardProp((prop) => prop !== "tabWidth"));

createRoot(document.getElementById("root"))
	.render(React.createElement(OptionsAppContainer));
