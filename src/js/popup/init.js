var gKeyCache = [],
	gShortcutCache = [],
	gClose = false,
	gOnKeyDown,
	gInitTime = performance.now(),
	gIsMac = /Mac/i.test(navigator.platform);


	// connect to the default port so the background page will get the
	// onDisconnect event when the popup is closed.  do it first thing, in case
	// the user quickly hits the shortcut again.
chrome.runtime.connect();


(function() {
	const AllowedPattern = /[-'!"#$%&()\*+,\.\/:;<=>?@\[\\\]\^_`{|}~ \w]/,
		ShortcutModifier = gIsMac ? "ctrlKey" : "altKey";


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
				if (event[ShortcutModifier]) {
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

	const background = chrome.extension.getBackgroundPage();

	window.log = background.log;
	window.tracker = background.tracker;

	window.addEventListener("error", function(event) {
		window.tracker.exception(event, true);
	});
})();
