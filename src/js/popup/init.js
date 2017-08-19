var gKeyCache = [],
	gClose = false,
	gOnKeyDown,
	gInitTime = performance.now();


(function() {
	var AllowedPattern = /[-'!"#$%&()\*+,\.\/:;<=>?@\[\\\]\^_`{|}~ \w]/,
		Escape = 27,
		Backspace = 8;


	gOnKeyDown = function(
		event)
	{
		var char = String.fromCharCode(event.which);

		if (!event.shiftKey) {
			char = char.toLocaleLowerCase();
		}

		switch (event.which) {
			case Escape:
				gClose = true;
				break;

			case Backspace:
				gKeyCache.pop();
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
