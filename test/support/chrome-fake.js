	// an in-memory stand-in for the subset of the chrome.* extension APIs that
	// QuicKey's non-UI modules touch.  it is deliberately small: it implements
	// the storage.local semantics the storage layer relies on (get(null) for
	// everything, get(string|array) for a subset, set() as a shallow merge) and
	// provides event hubs with addListener/removeListener/dispatch so tests can
	// drive tabs.onActivated and friends.  anything not exercised by the code
	// under test is either a no-op or absent, so a missing method surfaces as a
	// clear error rather than silently passing.

const MANIFEST = { version: "2.0.2", short_name: "QuicKey" };


	// a minimal event target matching the chrome.events.Event shape
function makeEvent()
{
	const listeners = new Set();

	return {
		addListener: (fn) => listeners.add(fn),
		removeListener: (fn) => listeners.delete(fn),
		hasListener: (fn) => listeners.has(fn),
			// test helper: synchronously invoke every registered listener
		dispatch: (...args) => [...listeners].map((fn) => fn(...args)),
			// test helper: how many listeners are attached
		listenerCount: () => listeners.size,
	};
}


export function createChromeFake(
	options = {})
{
	const {
			// installType "development" makes IsDev true and tags GA as dev; the
			// default keeps parity with a packed install
		installType = "normal",
			// seed for chrome.storage.local; callers usually reset() with their
			// own fixture in beforeEach
		storage = {},
	} = options;

	let store = structuredClone(storage);

	const local = {
		get: (keys) => {
			if (keys === null || keys === undefined) {
				return Promise.resolve(structuredClone(store));
			}

			if (typeof keys === "string") {
				return Promise.resolve(
					keys in store ? { [keys]: structuredClone(store[keys]) } : {}
				);
			}

			if (Array.isArray(keys)) {
				const result = {};

				for (const key of keys) {
					if (key in store) {
						result[key] = structuredClone(store[key]);
					}
				}

				return Promise.resolve(result);
			}

				// an object argument supplies defaults for any missing keys
			const result = {};

			for (const [key, fallback] of Object.entries(keys)) {
				result[key] = key in store
					? structuredClone(store[key])
					: structuredClone(fallback);
			}

			return Promise.resolve(result);
		},
		set: (items) => {
			for (const [key, value] of Object.entries(items)) {
				store[key] = structuredClone(value);
			}

			return Promise.resolve();
		},
		remove: (keys) => {
			for (const key of [].concat(keys)) {
				delete store[key];
			}

			return Promise.resolve();
		},
		clear: () => {
			store = {};

			return Promise.resolve();
		},
			// test helpers, not part of the real API
		_dump: () => structuredClone(store),
		_seed: (data) => { store = structuredClone(data); },
	};

	const chrome = {
		runtime: {
			id: "quickeyfakeextensionidaaaaaaaaaa",
			lastError: undefined,
			getManifest: () => ({ ...MANIFEST }),
			getURL: (path = "") => `chrome-extension://${chrome.runtime.id}/${path}`,
			getContexts: () => Promise.resolve([]),
			connect: () => ({
				name: "",
				postMessage: () => {},
				disconnect: () => {},
				onMessage: makeEvent(),
				onDisconnect: makeEvent(),
			}),
			sendMessage: () => Promise.resolve(),
			onMessage: makeEvent(),
			onConnect: makeEvent(),
			onInstalled: makeEvent(),
			onStartup: makeEvent(),
			onUpdateAvailable: makeEvent(),
		},
		management: {
			getSelf: () => Promise.resolve({ ...MANIFEST, installType }),
		},
		storage: {
			local,
			onChanged: makeEvent(),
		},
		tabs: {
			query: () => Promise.resolve([]),
			get: (id) => Promise.reject(new Error(`No tab with id: ${id}.`)),
			update: (id, props) => Promise.resolve({ id, ...props }),
			remove: () => Promise.resolve(),
			move: (id, props) => Promise.resolve({ id, ...props }),
			create: (props) => Promise.resolve({ id: 0, ...props }),
			onActivated: makeEvent(),
			onCreated: makeEvent(),
			onRemoved: makeEvent(),
			onReplaced: makeEvent(),
			onUpdated: makeEvent(),
		},
		windows: {
			WINDOW_ID_NONE: -1,
			getAll: () => Promise.resolve([]),
			get: (id) => Promise.resolve({ id }),
			update: (id, props) => Promise.resolve({ id, ...props }),
			create: (props) => Promise.resolve({ id: 0, tabs: [{ id: 0 }], ...props }),
			onFocusChanged: makeEvent(),
		},
		sessions: {
			getRecentlyClosed: () => Promise.resolve([]),
			restore: () => Promise.resolve({}),
		},
		commands: {
			getAll: () => Promise.resolve([{ name: "_execute_action" }]),
			onCommand: makeEvent(),
		},
		action: {
			setIcon: () => Promise.resolve(),
			setBadgeText: () => Promise.resolve(),
			setBadgeBackgroundColor: () => Promise.resolve(),
			setTitle: () => Promise.resolve(),
		},
		history: {
			deleteUrl: () => Promise.resolve(),
		},
	};

	return chrome;
}
