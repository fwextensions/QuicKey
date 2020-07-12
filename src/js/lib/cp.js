define([
	"lib/chrome-promise",
	"shared",
	"bluebird"
], (
	ChromePromise,
	shared,
	Promise
) => {
		// store a single ChromePromise instance on the background page, so
		// that if we used optional permissions, the background and popup
		// would have the same permissions
	return shared("cp", () => new ChromePromise({ Promise }));
});
