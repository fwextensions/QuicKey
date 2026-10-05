	// a minimal PostHog client for the extension.  the posthog-js SDK is
	// DOM-oriented (autocapture, session recording) and assumes a long-lived
	// page, neither of which fits an MV3 service worker, so we just post
	// events to the HTTP capture API directly, the same way ga4mp.js does
	// for GA4.  https://posthog.com/docs/api/capture

	// the project's API key and host are passed in by the caller.  if the
	// key isn't a valid phc_ key, the client no-ops, which keeps trackers
	// created without one, like in tests, from sending anything.
export function createPostHogClient({
	apiKey,
	host,
	distinctID,
	superProperties = {} })
{
	const properties = { ...superProperties };
	const enabled = /^phc_[A-Za-z0-9]+$/.test(apiKey);


	function register(
		newProperties)
	{
		Object.assign(properties, newProperties);
	}


	function capture(
		event,
		eventProperties = {})
	{
		if (!enabled) {
			return Promise.resolve();
		}

		return fetch(`${host}/i/v0/e/`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
				// keepalive lets the request finish even if the service
				// worker is torn down right after sending
			keepalive: true,
			body: JSON.stringify({
				api_key: apiKey,
				event,
				distinct_id: distinctID,
				properties: {
					...properties,
					...eventProperties,
						// anonymous events, so no person profiles are created,
						// which matches GA's model of unidentified clients
					$process_person_profile: false
				},
				timestamp: new Date().toISOString()
			})
		})
				// analytics must never break the extension
			.catch(error => globalThis.DEBUG && console.error("PostHog capture failed", error));
	}


	return {
		register,
		capture
	};
}
