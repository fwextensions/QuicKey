define(function() {
	const Defaults = {
		name: "tracker"
	};
	const PathPattern = /chrome-extension:\/\/[^\n]+\//g;
		// leave room for the other params in a GA call
	const MaxStackLength = 1000;
		// create a local ga var pointing at the global ga so that this module
		// can be loaded in a node context when we build the static popup HTML
	const ga = (window.ga = window.ga || function() { (ga.q = ga.q || []).push(arguments) });

	ga.l = +new Date;


	function Tracker(
		id,
		fields,
		setFields,
		dontSendPageview)
	{
		const createFields = Object.assign({}, Defaults, fields);

		if (!setFields || typeof setFields != "object") {
			dontSendPageview = setFields;
			setFields = null;
		}

		this.name = createFields.name;
		this.nameDotSend = this.name + ".send";
		this.nameDotSet = this.name + ".set";

		ga("create", id, createFields);

			// workaround the extension being in a chrome-extension:// protocol
		this.set("checkProtocolTask", null);

		if (setFields) {
			this.set(setFields);
		}

		if (!dontSendPageview) {
			this.pageview();
		}
	}


	Object.assign(Tracker.prototype, {
		send: function()
		{
			ga.apply(window, [this.nameDotSend, ...arguments]);
		},


		set: function(
			name,
			value)
		{
			if (name && typeof name == "object") {
				Object.keys(name).forEach(function(key) {
					ga(this.nameDotSet, key, name[key]);
				}, this);
			} else {
				ga(this.nameDotSet, name, value);
			}
		},


		event: function(
			category,
			action,
			value)
		{
			const event = {
				hitType: "event",
				eventCategory: category,
				eventAction: action
			};

			if (typeof value == "string") {
				event.eventLabel = value;
			} else if (typeof value == "number") {
				event.eventValue = value;
			}

			this.send(event);
		},


		pageview: function(
			name)
		{
				// only send the name if there is one, since passing undefined
				// seems to cause the pageview event not to use the set page name
			if (name) {
				this.send("pageview", name);
			} else {
				this.send("pageview");
			}
		},


		timing: function(
			category,
			name,
			value)
		{
			this.send("timing", category, name, Math.round(value));
		},


		exception: function(
			error,
			fatal)
		{
			let description = "";

			try {
				if (typeof error == "string") {
					description = error;
				} else if (error.error) {
					description = error.error.stack.replace(PathPattern, "").slice(0, MaxStackLength);
				} else {
					description = `${error.message}\n${error.lineno}, ${error.colno}: ${error.filename}`;
				}

				this.send("exception", {
					exDescription: description,
					exFatal: Boolean(fatal)
				});
			} catch (e) {
				console.error("Calling tracker.exception() failed.", e);
			}
		}
	});


	return Tracker;
});
