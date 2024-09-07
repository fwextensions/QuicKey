const arrayNoop = () => [];
const objectNoop = () => ({});


module.exports = {
	self: globalThis,
	window: globalThis,
	chrome: {
		runtime: {
			id: "ldlghkoiihaelfnggonhjnfiabmaficg",
			getURL: () => ""
		},
		extension: {
			getBackgroundPage: objectNoop
		},
		management: {
			getSelf: objectNoop
		},
		tabs: {
			query: arrayNoop
		},
		windows: {
			getAll: arrayNoop
		},
		sessions: {
			getRecentlyClosed: arrayNoop
		},
		commands: {
			getAll: () => [{ name: "_execute_action" }]
		},
		storage: {
			local: {
				get: arrayNoop,
				set: arrayNoop,
				clear: arrayNoop
			}
		}
	},
	navigator: {
		platform: "windows",
		languages: ["en-US"],
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36"
	},
	location: {
		search: ""
	},
	gKeyCache: [],
	gShortcutCache: [],
	gClose: false,
	gPort: null,
	gOnKeyDown: null,
	DEBUG: false,
};
