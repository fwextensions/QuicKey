define([
	"lib/ga4mp.umd",
	"./client-id",
], function(
	ga4mp,
	clientID
) {
	const PathPattern = /chrome-extension:\/\/[^\n]+\//g;
	const MaxStackLength = 2000;
	const DefaultSettings = {
		client_id: clientID,
		user_id: undefined,
		non_personalized_ads: true,
		debug: true,
	};

	class Tracker {
		constructor({
			id,
			settings = {},
			sendPageview = true})
		{
			if (!id || typeof id !== "string") {
				throw new Error("A Google Analytics 4 tracker ID is required.");
			}

				// the esprima parser used by RequireJS doesn't support the object
				// spread operator, so use assign()
			this.ga4 = ga4mp([id], Object.assign({}, DefaultSettings, settings));
			this.enabled = true;

			if (sendPageview) {
				this.pageview();
			}
		}

		enable()
		{
			this.enabled = true;
		}

		disable()
		{
			this.enabled = false;
		}

		send(
			event,
			params)
		{
			this.ga4.trackEvent(event, params);
		}

		set(
			name,
			value)
		{
			if (name && typeof name == "object") {
				Object.entries(name).forEach(([key, value]) => this.ga4.setEventsParameter(key, value));
			} else {
				this.ga4.setEventsParameter(name, value);
			}
		}

		event(
			category,
			action,
			value)
		{
			const eventName = action && typeof action == "string"
				? action
				: category;
			let params;

			if (action) {
				if (typeof action == "object") {
					params = action;
				} else {
					params = { event_category: category };

					if (typeof value == "string") {
						params.event_label = value;
					} else if (typeof value == "number") {
						params.value = value;
					}
				}
			}

			this.send(eventName, params);
		}

		pageview()
		{
			this.send("page_view");
		}

		timing(
			category,
			name,
			value)
		{
			if (category == "loading") {
				this.send("timing_complete", {
					event_category: category,
					event_label: name,
					value: Math.round(value)
				});
			} else {
				this.send(category, name, Math.round(value));
			}
		}

		exception(
			error,
			fatal)
		{
			let description;

			try {
				if (!error) {
					description = "Generic error";
				} else if (typeof error == "string") {
					description = error;
				} else if (error.stack) {
						// reduce the noise of the protocol repeating in every URL
					description = error.stack.replace(PathPattern, "").slice(0, MaxStackLength);
				} else if (error.message) {
					const location = error.lineno
						? `\n${error.lineno}, ${error.colno}: ${error.filename}`
						: "";

					description = `${error.message}${location}`;
				}

				this.send("exception", {
					description: description,
					fatal: Boolean(fatal)
				});
			} catch (e) {
				console.error("Calling tracker.exception() failed.", e);
			}
		}
	}

	return Tracker;
});
