	// an in-memory stand-in for the subset of the chrome.* extension APIs that
	// QuicKey's non-UI modules touch.  it is deliberately small: it implements
	// the storage.local semantics the storage layer relies on (get(null) for
	// everything, get(string|array) for a subset, set() as a shallow merge),
	// provides event hubs with addListener/removeListener/dispatch so tests can
	// drive tabs.onActivated and friends, and keeps a mutable tab/window model
	// so that tabs.create()/update()/remove() and windows.update() behave like
	// the real browser: they change state *and* fire the matching events.
	// anything not exercised by the code under test is either a no-op or
	// absent, so a missing method surfaces as a clear error rather than
	// silently passing.

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
			// test helper: the registered listener functions, so a harness can
			// snapshot and later detach the ones a given module graph added
		_listeners: () => [...listeners],
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
			// seed for the tab/window model; same shape as tabs._seed() takes
		tabs: seedTabs = [],
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


		// ==== the mutable tab/window model ====================================
		//
		// tabs and windows live in flat arrays; mutating APIs update the model
		// and then fire the same events the real browser would, so code wired
		// up through tabs.onActivated etc. sees a realistic sequence.  the
		// supported tabs.query() filters are exactly the ones the source uses
		// (active, currentWindow, lastFocusedWindow, windowId, windowType, url);
		// an unsupported filter key throws so a test can't silently pass.

	let allTabs = [];
	let allWindows = [];
	let focusedWindowId = -1;
	let nextTabId = 1;
	let nextWindowId = 1;

	function getWindowById(
		id)
	{
		return allWindows.find((win) => win.id === id);
	}

	function getTabById(
		id)
	{
		return allTabs.find((tab) => tab.id === id);
	}

	function ensureWindow(
		id,
		props = {})
	{
		let win = getWindowById(id);

		if (!win) {
			win = {
				id,
				type: "normal",
				focused: false,
				incognito: false,
				left: 0,
				top: 0,
				width: 1280,
				height: 720,
				...props,
			};
			allWindows.push(win);
			nextWindowId = Math.max(nextWindowId, id + 1);
		}

		return win;
	}

	function windowTabs(
		windowId)
	{
		return allTabs.filter((tab) => tab.windowId === windowId);
	}

	function cloneTab(
		tab)
	{
		return { ...tab, index: windowTabs(tab.windowId).indexOf(tab) };
	}

	function cloneWindow(
		win,
		populate)
	{
		const result = { ...win };

		if (populate) {
			result.tabs = windowTabs(win.id).map(cloneTab);
		}

		return result;
	}

		// make tabId the active tab of its window, firing onActivated only when
		// the activation actually changes something, like the real browser
	function activateTab(
		tab)
	{
		if (tab.active) {
			return;
		}

		for (const other of windowTabs(tab.windowId)) {
			other.active = false;
		}

		tab.active = true;
		chromeFake.tabs.onActivated.dispatch({
			tabId: tab.id,
			windowId: tab.windowId,
		});
	}

	function focusWindow(
		windowId)
	{
		if (windowId === focusedWindowId) {
			return;
		}

		for (const win of allWindows) {
			win.focused = win.id === windowId;
		}

		focusedWindowId = windowId;
		chromeFake.windows.onFocusChanged.dispatch(windowId);
	}

	function matchesURLPattern(
		url,
		pattern)
	{
		return pattern.endsWith("*")
			? String(url).startsWith(pattern.slice(0, -1))
			: url === pattern;
	}

	const QueryFilters = {
		active: (tab, value) => tab.active === value,
		windowId: (tab, value) => tab.windowId === value,
		currentWindow: (tab, value) => (tab.windowId === focusedWindowId) === value,
		lastFocusedWindow: (tab, value) => (tab.windowId === focusedWindowId) === value,
		windowType: (tab, value) => getWindowById(tab.windowId)?.type === value,
		url: (tab, value) => matchesURLPattern(tab.url, value),
	};

	function queryTabs(
		filter = {})
	{
		let result = allTabs;

		for (const [key, value] of Object.entries(filter)) {
			const match = QueryFilters[key];

			if (!match) {
				throw new Error(`chrome fake: unsupported tabs.query() filter: ${key}`);
			}

			result = result.filter((tab) => match(tab, value));
		}

		return result.map(cloneTab);
	}

	function createTab(
		props = {},
		fireEvents = true)
	{
		const {
			id = nextTabId,
			windowId = focusedWindowId === -1 ? nextWindowId : focusedWindowId,
			url = "about:blank",
			title = url,
			active = true,
			...rest
		} = props;

		ensureWindow(windowId);

		const tab = { id, windowId, url, title, active: false, pinned: false, ...rest };

		allTabs.push(tab);
		nextTabId = Math.max(nextTabId, id + 1);

		if (fireEvents) {
			chromeFake.tabs.onCreated.dispatch(cloneTab(tab));
		}

		if (active) {
			if (fireEvents) {
				activateTab(tab);
			} else {
				for (const other of windowTabs(tab.windowId)) {
					other.active = other === tab;
				}
			}
		}

		return tab;
	}

	function removeTab(
		id,
		isWindowClosing = false)
	{
		const tab = getTabById(id);

		if (!tab) {
			return Promise.reject(new Error(`No tab with id: ${id}.`));
		}

		allTabs = allTabs.filter((other) => other !== tab);
		chromeFake.tabs.onRemoved.dispatch(tab.id, {
			windowId: tab.windowId,
			isWindowClosing,
		});

		const remaining = windowTabs(tab.windowId);

		if (!remaining.length) {
				// the window is now empty, so drop it and focus another one, the
				// way closing a window's last tab closes the window
			allWindows = allWindows.filter((win) => win.id !== tab.windowId);

			if (focusedWindowId === tab.windowId) {
				const nextFocused = allWindows[allWindows.length - 1];

				focusWindow(nextFocused ? nextFocused.id : chromeFake.windows.WINDOW_ID_NONE);
			}
		} else if (tab.active) {
				// the browser picks a neighbor when the active tab closes; the
				// last remaining tab is close enough for tests
			activateTab(remaining[remaining.length - 1]);
		}

		return Promise.resolve();
	}


	const chromeFake = {
		runtime: {
			id: "quickeyfakeextensionidaaaaaaaaaa",
			lastError: undefined,
			ContextType: { TAB: "TAB", POPUP: "POPUP", BACKGROUND: "BACKGROUND" },
			getManifest: () => ({ ...MANIFEST }),
			getURL: (path = "") => `chrome-extension://${chromeFake.runtime.id}/${path}`,
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
			query: (filter) => Promise.resolve(queryTabs(filter)),
			get: (id) => {
				const tab = getTabById(id);

				return tab
					? Promise.resolve(cloneTab(tab))
					: Promise.reject(new Error(`No tab with id: ${id}.`));
			},
			create: (props) => {
				const tab = createTab(props);

				return Promise.resolve(cloneTab(tab));
			},
			update: (id, props) => {
				const tab = getTabById(id);

				if (!tab) {
					return Promise.reject(new Error(`No tab with id: ${id}.`));
				}

				const { active, ...rest } = props;

				Object.assign(tab, rest);

				if (active) {
					activateTab(tab);
				}

				return Promise.resolve(cloneTab(tab));
			},
			remove: (ids) => Promise.all([].concat(ids).map((id) => removeTab(id)))
				.then(() => undefined),
			move: (id, { windowId, index }) => {
				const tab = getTabById(id);

				if (!tab) {
					return Promise.reject(new Error(`No tab with id: ${id}.`));
				}

				if (windowId !== undefined) {
					ensureWindow(windowId);
					tab.windowId = windowId;
				}

				return Promise.resolve(cloneTab(tab));
			},
			onActivated: makeEvent(),
			onCreated: makeEvent(),
			onRemoved: makeEvent(),
			onReplaced: makeEvent(),
			onUpdated: makeEvent(),

				// test helpers, not part of the real API.  _seed() replaces the
				// whole tab/window model without firing any events: each entry is
				// { id?, url?, title?, windowId?, active?, windowType? }, windows
				// are created implicitly from the windowIds, the window containing
				// the first active tab becomes focused, and each window without an
				// explicitly active tab activates its first one.
			_seed: (specs) => {
				allTabs = [];
				allWindows = [];
				focusedWindowId = -1;
				nextTabId = 1;
				nextWindowId = 1;

				for (const { windowType, ...spec } of specs) {
					const windowId = spec.windowId ?? 1;

					ensureWindow(windowId, windowType ? { type: windowType } : {});
					createTab({ active: false, ...spec, windowId }, false);
				}

				for (const win of allWindows) {
					const tabs = windowTabs(win.id);

					if (tabs.length && !tabs.some(({ active }) => active)) {
						tabs[0].active = true;
					}
				}

				const activeTab = allTabs.find(({ active }) => active);
				const focusedId = activeTab ? activeTab.windowId : allWindows[0]?.id;

				if (focusedId !== undefined) {
					for (const win of allWindows) {
						win.focused = win.id === focusedId;
					}

					focusedWindowId = focusedId;
				}
			},
			_dump: () => ({
				tabs: allTabs.map(cloneTab),
				windows: allWindows.map((win) => cloneWindow(win)),
				focusedWindowId,
			}),
		},
		windows: {
			WINDOW_ID_NONE: -1,
			getAll: ({ populate, windowTypes } = {}) => Promise.resolve(
				allWindows
					.filter((win) => !windowTypes || windowTypes.includes(win.type))
					.map((win) => cloneWindow(win, populate))
			),
			get: (id) => {
				const win = getWindowById(id);

				return win
					? Promise.resolve(cloneWindow(win))
					: Promise.reject(new Error(`No window with id: ${id}.`));
			},
			update: (id, props) => {
				const win = getWindowById(id);

				if (!win) {
					return Promise.reject(new Error(`No window with id: ${id}.`));
				}

				const { focused, ...rest } = props;

				Object.assign(win, rest);

				if (focused) {
					focusWindow(win.id);
				}

				return Promise.resolve(cloneWindow(win));
			},
			create: ({ url, tabId, type = "normal", focused = true, ...rest } = {}) => {
				const win = ensureWindow(nextWindowId, { type, ...rest });
				let tab;

				if (tabId !== undefined) {
					tab = getTabById(tabId);
					tab.windowId = win.id;
				} else {
					tab = createTab({ url, windowId: win.id });
				}

				if (focused) {
					focusWindow(win.id);
				}

				return Promise.resolve(cloneWindow(win, true));
			},
			onFocusChanged: makeEvent(),
		},
		sessions: {
			getRecentlyClosed: () => Promise.resolve([]),
			restore: () => Promise.resolve({}),
		},
		system: {
			display: {
				onDisplayChanged: makeEvent(),
				getInfo: () => Promise.resolve([
					{ workArea: { left: 0, top: 0, width: 1920, height: 1080 } },
				]),
			},
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

	if (seedTabs.length) {
		chromeFake.tabs._seed(seedTabs);
	}

	return chromeFake;
}
