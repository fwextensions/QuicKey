import { transformAsync } from "@babel/core";

	// the source keeps JSX in plain .js files, which vite's native transform
	// won't parse, and babel-plugin-transform-goober is required semantically:
	// it rewrites styled.div`...` to styled("div")`...`, and goober itself has
	// no runtime support for the property-access form.  this replaces what
	// babel-loader + .babelrc did under webpack (minus preset-env, which is
	// unnecessary when targeting current Chrome).
export default function babelJsx()
{
	return {
		name: "quickey:babel-jsx",
		enforce: "pre",
		async transform(code, id)
		{
			if (!id.endsWith(".js") || id.includes("node_modules")) {
				return null;
			}

			const result = await transformAsync(code, {
				filename: id,
				babelrc: false,
				configFile: false,
				compact: false,
				sourceMaps: true,
				plugins: [
						// classic runtime, matching the old preset-react
						// setup; every JSX file imports React itself
					"@babel/plugin-transform-react-jsx",
					"babel-plugin-transform-goober",
				],
			});

			return { code: result.code, map: result.map };
		}
	};
}
