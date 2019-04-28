define([
	"lib/chrome-promise",
	"shared",
	"bluebird"
], function(
	ChromePromise,
	shared,
	Promise
) {
		// store a single ChromePromise instance on the background page, so
		// that if we used optional permissions, the background and popup
		// would have the same permissions
	return shared("cp", function() {
		return new ChromePromise({ Promise: Promise });
	});
});
