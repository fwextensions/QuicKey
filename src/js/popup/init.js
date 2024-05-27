{
	const params = new URLSearchParams(location.search);
	const reloadedParam = "reloaded";

	if (typeof chrome.runtime?.connect !== "function") {
		if (!params.has(reloadedParam)) {
				// the chrome.runtime API isn't available for some reason, so we
		  		// want to reload to fix it, but only if we haven't already
				// reloaded once, so we don't get in a loop
			const reloadURL = new URL(location.href);

			reloadURL.searchParams.set(reloadedParam, true);
			history.replaceState(null, null, reloadURL);
			location.href = reloadURL;
		}
	} else if (params.has(reloadedParam)) {
		chrome.extension.getBackgroundPage().warn("BAD API: Popup reloaded");
	}
}

	// connect to the default port so the background page will get the
	// onDisconnect event when the popup is closed.  do it first thing, in case
	// the user quickly hits the shortcut again.  pass in a name based on
	// whether we're in a popup window so the background knows where it's from.
const gPort = chrome.runtime.connect({ name: location.search.includes("props") ? "popup" : "menu" });
const gInitTime = performance.now();

let gKeyCache = [];
let gShortcutCache = [];
let gClose = false;
let gOnKeyDown;

	// check lastError to suppress errors showing up in the extensions page
chrome.runtime.lastError && console.log("Chrome error:", chrome.runtime.lastError);

{
	const AllowedPattern = /[-'!"#$%&()\*+,\.\/:;<=>?@\[\\\]\^_`{|}~ \w]/;

		// point these globals at the popup's console, not the background page's
	["log", "warn", "error"].forEach((method) => window[method] = console[method]);


	gOnKeyDown = function(
		event)
	{
		var char = String.fromCharCode(event.which);

		if (!event.shiftKey) {
			char = char.toLocaleLowerCase();
		}

		switch (event.which) {
			case 27:	// esc
				gClose = true;
				break;

			case 8:		// backspace
				gKeyCache.pop();
				break;

			default:
					// we don't know yet which modifier keys were used to open
					// the popup, but if they're still pressed, they're almost
					// certainly the ones set in Chrome, so assume any
					// modifier+key events are for navigating the MRU list
				if (event.altKey || event.ctrlKey || event.metaKey) {
					gShortcutCache.push(char);
				} else if (AllowedPattern.test(char)) {
					gKeyCache.push(char);
				}
				break;
		}
	};

		// listen to key events that happen before the React code fully loads
		// and instantiates the components. the gKeyCache global will be passed
		// to the TabSelector as the default query when it loads.
	document.addEventListener("keydown", gOnKeyDown);
}
