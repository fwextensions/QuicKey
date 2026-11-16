import Tracker from "./tracker";
import { IsEdge } from "./constants";
import { getBrowserInfo } from "@/lib/browser-info";


const GA4ID = IsEdge
	? "G-C4JVSJ09QQ"
	: "G-Y6PNZ406H1";
	// the QuicKey project's API key, which is public and safe to ship in the
	// bundle, like the GA IDs above.  use https://eu.i.posthog.com for a
	// project hosted in the EU region.
const PostHogSettings = {
	apiKey: "phc_9xd4G5AYHtZCBizFaVnQRsguCsDTTPmX0Sp0sQW20lN",
	host: "https://us.i.posthog.com"
};
const ClientIDKey = "clientID";


	// await an IIFE to make some async calls that we then use to init a function
	// that then returns a function that creates trackers with standard settings.
	// this is a workaround so that createTracker() doesn't have to be async.
const createTracker = await (async () => {
	const { version, installType } = await chrome.management.getSelf();
	const browserInfo = await getBrowserInfo();
	let { [ClientIDKey]: client_id } = await chrome.storage.local.get(ClientIDKey);

	if (!client_id) {
			// create a default client ID and then save it to storage
		client_id = crypto.randomUUID();
		await chrome.storage.local.set({ [ClientIDKey]: client_id });
	}

	return (name) => new Tracker({
		id: GA4ID,
		posthog: {
			...PostHogSettings,
				// GA already splits Chrome from Edge with separate IDs, but
				// PostHog gets both under one key, and neither one could tell
				// a fork like Brave or Vivaldi from Chrome
			superProperties: browserInfo
		},
		name,
		settings: {
			client_id,
			persistentEventParameters: {
				page_location: `/${name}.html`,
				page_title: `/${name}`,
					// these names match the "Extension version" and "Install
					// type" custom dimensions registered in GA4.  installType
					// is "development" for unpacked builds, which is how dev
					// events are filtered out.
				version,
				installType
			}
		}
	});
})();


export default {
	background: createTracker("background"),
	popup: createTracker("popup"),
	options: createTracker("options"),
};
