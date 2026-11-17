	// mutable state shared between the background modules.  it's exported as
	// a single object whose properties are read and set by the consumers,
	// since ESM doesn't allow imported bindings to be assigned directly.
export default {
	startingUp: false,
	activeTab: null,
	navigateRecentsWithPopup: false,
	navigatingRecents: false,
};
