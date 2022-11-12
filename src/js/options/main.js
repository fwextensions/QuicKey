import React from "react";
import { createRoot } from "react-dom/client";
import OptionsAppContainer from "./app-container";

createRoot(document.getElementById("root"))
	.render(React.createElement(OptionsAppContainer));
