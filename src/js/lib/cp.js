define([
	"lib/chrome-promise",
	"bluebird"
], function(
	ChromePromise,
	Promise
) {
	var background = chrome.extension.getBackgroundPage(),
		cp = background.cp;

	if (!cp) {
			// store a single ChromePromise instance on the background page, so
			// that if we used optional permissions, the background and popup
			// would have the same permissions
		cp = background.cp = new ChromePromise({ Promise: Promise });
	}

	return cp;
});
