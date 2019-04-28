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
			background: new Tracker(TrackerID,
				{
					name: "background"
				},
				{
					location: "/background.html",
					page: "/background",
					transport: "beacon"
				},
				true),
			popup: new Tracker(TrackerID,
				{
					name: "popup"
				},
				{
					location: "/popup.html",
					page: "/popup",
					transport: "beacon"
				},
				true),
			options: new Tracker(TrackerID,
				{
					name: "options"
				},
				{
					location: "/options.html",
					page: "/options",
					transport: "beacon"
				},
				true)
		};
	});
});
