define(function() {
	const Defaults = {
			name: "tracker"
		},
		PathPattern = /chrome-extension:\/\/[^\n]+\//g;


	window.ga = window.ga || function() { (ga.q = ga.q || []).push(arguments) };
	ga.l = +new Date;


	function Tracker(
		id,
		fields,
		setFields,
		dontSendPageview)
	{
		var createFields = Object.assign({}, Defaults, fields);

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
			ga.apply(window, [this.nameDotSend].concat(Array.from(arguments)));
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
			var event = {
					hitType: "event",
					eventCategory: category,
					eventAction: action
				};

			if (typeof value != "undefined") {
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
			var description;

			if (error.error) {
				description = error.error.stack.replace(PathPattern, "");
			} else {
				description = [error.message, error.lineno + ": " + error.filename].join("\n");
			}

			this.send("exception", {
				exDescription: description,
				exFatal: fatal
			});
		}
	});


	return Tracker;
});
