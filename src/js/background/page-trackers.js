import Tracker from "./tracker";
import { IsEdge } from "./constants";


const TrackerID = IsEdge
	? "G-C4JVSJ09QQ"
	: "G-Y6PNZ406H1";
const ClientIDKey = "clientID";


	// await an IIFE to make some async calls that we then use to init a function
	// that then returns a function that creates trackers with standard settings.
	// this is a workaround so that createTracker() doesn't have to be async.
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
