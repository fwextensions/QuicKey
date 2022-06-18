require.config({
	baseUrl: "/js",
	paths: {
		react: "lib/react.min",
		"react-dom": "lib/react-dom.min",
		jsx: "lib/jsx",
		text: "lib/text",
		JSXTransformer: "lib/JSXTransformer",
		"react-virtualized": "lib/react-virtualized",
		lodash: "lib/lodont",
		cp: "lib/cp",
		shared: "lib/shared",
		bluebird: "lib/bluebird.core.min",
		"fast-memoize": "lib/fast-memoize"
	},
	map: {
		"react-virtualized": {
			"React": "react",
			"ReactDOM": "react-dom"
		}
	}
});
