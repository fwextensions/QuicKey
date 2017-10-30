var gKeyCache = [],
	gClose = false,
	gSwitchToLastTab = false,
	gOnKeyDown,
	gInitTime = performance.now();


(function() {
	var AllowedPattern = /[-'!"#$%&()\*+,\.\/:;<=>?@\[\\\]\^_`{|}~ \w]/;


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

			case 13:	// enter
			case 9:		// tab
				gSwitchToLastTab = true;
				break;

			default:
				if (AllowedPattern.test(char)) {
					gKeyCache.push(char);
				}
				break;
		}
	};


		// listen to key events that happen before the React code fully loads
		// and instantiates the components. the gKeyCache global will be passed
		// to the TabSelector as the default query when it loads.
	document.addEventListener("keydown", gOnKeyDown);
})();
