define([
	"shared",
	"./tracker"
], function(
	shared,
	Tracker
) {
	const TrackerID = "UA-108153491-3";


	return shared("trackers", function() {
			// create a separate tracker for the background and popup pages, so
			// the events get tracked on the right page.  pass true to not do an
			// automatic pageview on creation in this module.
		return {
			background: new Tracker({
				id: TrackerID,
				name: "background",
				settings: {
					location: "/background.html",
					page: "/background",
					transport: "beacon"
				},
				sendPageview: false
			}),
			popup: new Tracker({
				id: TrackerID,
				name: "popup",
				settings: {
					location: "/popup.html",
					page: "/popup",
					transport: "beacon"
				},
				sendPageview: false
			}),
			options: new Tracker({
				id: TrackerID,
				name: "options",
				settings: {
					location: "/options.html",
					page: "/options",
					transport: "beacon"
				},
				sendPageview: false
			})
		};
	});
});
