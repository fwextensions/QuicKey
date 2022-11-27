import React from "react";
import { createRoot } from "react-dom/client";
import {setup} from "goober";
import OptionsAppContainer from "./app-container";

setup(React.createElement);

createRoot(document.getElementById("root"))
	.render(React.createElement(OptionsAppContainer));
