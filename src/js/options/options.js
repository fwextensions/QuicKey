(function() {
	function openConfigureCommands()
	{
		chrome.tabs.update({ url: "chrome://extensions/configureCommands" });
	}


	const button = document.getElementById("keyboard-shortcuts");

		// add a click handler in the options dialog in case the tab update below
		// doesn't redirect to the keyboard shortcuts dialog for some reason
	button.addEventListener("click", function() {
		openConfigureCommands();
	});

	openConfigureCommands();
})();
