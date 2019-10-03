define(function() {
	const PathPattern = /chrome-extension:\/\/[^\n]+\//g;
	const MaxStackLength = 2000;
	const GALoadTimeout = 30 * 1000;


	const global = typeof window == "object" ? window : {};

	if (typeof global.ga !== "function") {
		function ga(...args) { ga.q.push(args) }

		ga.q = [];
		ga.l = Date.now();
		global.ga = ga;
		global.GoogleAnalyticsObject = "ga";
	}


	function Tracker({
		id,
		name = "t0",
		createFields = {},
		settings = {},
		sendPageview = true})
	{
		if (!id || typeof id !== "string") {
			throw new Error("A Universal Analytics tracker ID is required.");
		}

		this.name = name;
		this.enable();

			// the esprima parser used by RequireJS doesn't support the object
			// spread operator, and it's not supported until Chrome 61 anyway
		this.ga("create", id, Object.assign({ name }, createFields));

		if (global.location && global.location.protocol == "chrome-extension:") {
				// workaround the extension being in a chrome-extension:// protocol
			this.set("checkProtocolTask", null);
		}

		this.set(settings);

		if (sendPageview) {
			this.pageview();
		}

		setTimeout(() => {
			if (!global.ga.answer) {
					// the analytics code hasn't loaded within the timeout,
					// which means it probably will never load.  disable the
					// tracker so that we're not queuing an endless array of
					// events that will never be flushed.
				this.disable(true);
			}
		}, GALoadTimeout);
	}


	Object.assign(Tracker.prototype, {
		enable: function()
		{
			this.enabled = true;
		},


		disable: function(
			clearQueue)
		{
			this.enabled = false;

				// the real ga object has an answer == 42 property
			if (clearQueue && !global.ga.answer) {
				global.ga.q.length = 0;
			}
		},


		ga: function(
			command,
			...args)
		{
				// passing a name with the create command doesn't work
			const commandString = command == "create" ? command : `${this.name}.${command}`;

			if (this.enabled) {
				global.ga(commandString, ...args);
			}
		},


		send: function(
			...args)
		{
			this.ga("send", ...args);
		},


		set: function(
			name,
			value)
		{
			if (name && typeof name == "object") {
				Object.keys(name).forEach(key => this.ga("set", key, name[key]));
			} else {
				this.ga("set", name, value);
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
			error = "Generic error",
			fatal)
		{
			let description;

			try {
				if (typeof error == "string") {
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
