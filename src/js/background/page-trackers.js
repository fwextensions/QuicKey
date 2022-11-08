import cp from "cp";
import shared from "@/lib/shared";
import Tracker from "./tracker";
import {IsEdge} from "./constants";


const TrackerID = `UA-108153491-${IsEdge ? "4" : "3"}`;


export default shared("trackers", () => {
		// create a separate tracker for the background, popup and options
		// pages, so the events get tracked with the right URL
	const trackers = {
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
		}),
		ready: cp.management.getSelf().then(info => {
			const dimensions = {
				"dimension1": info.version,
				"dimension2": info.installType == "development" ? "D" : "P"
			};

				// just loop over the trackers, not this promise handler
			Object.values(trackers).slice(0, 3)
				.forEach(tracker => tracker.set(dimensions));

			return trackers;
		})
	};

	return trackers;
});
