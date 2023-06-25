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
	const TrackerID = `UA-108153491-${IsEdge ? "4" : "3"}`;

	const ga4tracker = ga4mp(["G-C4JVSJ09QQ"], {
		client_id: clientID,
		user_id: undefined,
		non_personalized_ads: true,
		debug: true
	});

	window.t = ga4tracker;

//	ga4tracker.trackEvent("page_view");
//	ga4tracker.trackEvent("recents", "next");

	console.log(ga4tracker.getSessionId(), ga4tracker.getClientId());
//window.log("==== derp");
//window.log(ga4tracker);
//console.log(ga4tracker)

	return shared("trackers", function() {
			// create a separate tracker for the background, popup and options
			// pages, so the events get tracked with the right URL
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
