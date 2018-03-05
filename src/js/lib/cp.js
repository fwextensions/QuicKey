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
		cp = background.cp = new ChromePromise({ Promise: Promise });
	}

	return cp;
});
