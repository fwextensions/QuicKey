import Tracker from "./tracker";
import { IsEdge } from "./constants";


const TrackerID = IsEdge
	? "G-C4JVSJ09QQ"
	: "G-Y6PNZ406H1";
const ClientIDKey = "clientID";


	// use an IIFE to init a function to create trackers with standard settings
const createTracker = await (async () => {
	const { version: dimension1, installType } = await chrome.management.getSelf();
	const dimension2 = installType === "development" ? "D" : "P";
	let { [ClientIDKey]: client_id } = await chrome.storage.local.get(ClientIDKey);

	if (!client_id) {
			// create a default client ID and then save it to storage
		client_id = crypto.randomUUID();
		await chrome.storage.local.set({ [ClientIDKey]: client_id });
	}

	return (name) => new Tracker({
		id: TrackerID,
		name,
		settings: {
			client_id,
			persistentEventParameters: {
				page_location: `/${name}.html`,
				page_title: `/${name}`,
				dimension1,
				dimension2
			}
		},
		sendPageview: false
	});
})();


export default {
	background: createTracker("background"),
	popup: createTracker("popup"),
	options: createTracker("options"),
};
