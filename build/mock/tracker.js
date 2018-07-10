	// the tracker module expects there to be a window global, so create one
	// here before loading it
window = {};

define([
	"original-tracker"
], function(
	Tracker
) {
	return Tracker;
});
