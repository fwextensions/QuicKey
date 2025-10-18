const state = {
	startingUp: false,
	activeTab: null,
	navigateRecentsWithPopup: false,
	navigatingRecents: false,
};

// TODO: this will only work when built with webpack, since ESM modules don't
//  allow directly setting an imported variable.  but it works well enough for now.
for (const key of Object.keys(state)) {
	Object.defineProperty(module.exports, key, {
		get: () => state[key],
		set: value => (state[key] = value),
		enumerable: true,
		configurable: false,
	});
}
