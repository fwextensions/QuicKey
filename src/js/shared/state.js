	// mutable state shared between the background modules.  it's exported as
	// a single object whose properties are read and set by the consumers,
	// since ESM doesn't allow imported bindings to be assigned directly.
export default {
	startingUp: false,
	activeTab: null,
	navigateRecentsWithPopup: false,
	navigatingRecents: false,

		// temporary instrumentation -- see trackRestoreProgress() in
		// background.js.  restoreStartTime is 0 except in the worker instance
		// that handled onStartup, which is what keeps the counting free for
		// every other tab creation.
	restoreStartTime: 0,
	restoreTabCount: 0,
	restoreFirstTabTime: 0,
	restoreLastTabTime: 0,
};
