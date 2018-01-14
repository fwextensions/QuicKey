define([
	"lib/chrome-promise",
	"bluebird"
], function(
	ChromePromise,
	Promise
) {
	return new ChromePromise({ Promise: Promise });
});
