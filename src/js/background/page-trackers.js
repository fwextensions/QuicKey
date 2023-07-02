define([
	"shared",
	"lib/ga4mp.umd",
	"./tracker",
	"./client-id",
	"./constants"
], function(
	shared,
	ga4mp,
	Tracker,
	clientID,
	{ IsEdge }
) {
	const TrackerID = IsEdge
		? "G-C4JVSJ09QQ"
		: "G-Y6PNZ406H1";

	return shared("trackers", function() {
			// create a separate tracker for the background, popup and options
			// pages, so the events get tracked with the right URL
		return {
			background: new Tracker({
				id: TrackerID,
				settings: {
					persistentEventParameters: {
						page_location: "/background.html",
						page_title: "/background",
					}
				},
				sendPageview: false
			}),
			popup: new Tracker({
				id: TrackerID,
				settings: {
					persistentEventParameters: {
						page_location: "/popup.html",
						page_title: "/popup",
					}
				},
				sendPageview: false
			}),
			options: new Tracker({
				id: TrackerID,
				settings: {
					persistentEventParameters: {
						page_location: "/options.html",
						page_title: "/options",
					}
				},
				sendPageview: false
			})
		};
	});
});
