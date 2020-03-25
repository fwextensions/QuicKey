	// this is called within the browserify context which has a local require().
	// so browserify will provide the pinyin node module, and then define makes
	// it available to requirejs modules.
define(() => require("pinyin"));
