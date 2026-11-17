const arrayNoop = () => Promise.resolve([]);
const objectNoop = () => Promise.resolve({});


module.exports = {
	self: globalThis,
	window: globalThis,
	chrome: {
		runtime: {
			onConnect: {
				addListener: () => {},
				removeListener: () => {}
			},
			connect: () => ({
				onMessage: { addListener: () => {}, removeListener: () => {} },
				onDisconnect: { addListener: () => {}, removeListener: () => {} },
				postMessage: () => {},
				disconnect: () => {}
			}),
			getContexts: arrayNoop,
			ContextType: { TAB: "TAB" },
			id: "ldlghkoiihaelfnggonhjnfiabmaficg",
			getURL: () => "",
				// include update_url so IsDev is false, matching the
				// installType the old mock produced
			getManifest: () => ({
				version: "0.0.0",
				update_url: "https://clients2.google.com/service/update2/crx"
			})
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
			getAll: () => Promise.resolve([{ name: "_execute_action" }])
		},
		storage: {
			local: {
				get: objectNoop,
				set: objectNoop,
				remove: objectNoop,
				clear: objectNoop
			}
		}
	},
	navigator: {
		locks: {
			request: (name, callback) => Promise.resolve(callback())
		},
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
