define(function() {
		// add a polyfill for Chrome < 92
		// https://stackoverflow.com/a/2117523/2800218
		// LICENSE: https://creativecommons.org/licenses/by-sa/4.0/legalcode
	const createUUID = typeof crypto.randomUUID === "function"
		? () => crypto.randomUUID()
		: () => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
			.replace(
				/[018]/g,
				c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
			);

	const ClientIDKey = "clientID";
	let clientID = localStorage.getItem(ClientIDKey);

	if (!clientID) {
		clientID = createUUID();
		localStorage.setItem(ClientIDKey, clientID);
	}

	return clientID;
});
