require.config({
	baseUrl: "/js",
	paths: {
		react: "lib/react.min",
		"react-dom": "lib/react-dom.min",
		jsx: "lib/jsx",
		text: "lib/text",
		JSXTransformer: "lib/JSXTransformer",
		"react-virtualized": "lib/react-virtualized",
		lodash: "lib/lodash",
		cp: "lib/cp",
		bluebird: "lib/bluebird.min"
	},
	map: {
		"react-virtualized": {
			"React": "react",
			"ReactDOM": "react-dom"
		}
	}
});
