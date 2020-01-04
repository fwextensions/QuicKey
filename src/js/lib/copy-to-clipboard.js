define(function() {
	return function copyTextToClipboard(
		text)
	{
		const copyFrom = document.createElement("textarea");
		const body = document.body;
		const activeElement = document.activeElement;
		let result;

		copyFrom.textContent = text;
		body.appendChild(copyFrom);
		copyFrom.focus();
		copyFrom.select();
		result = document.execCommand("copy");
		body.removeChild(copyFrom);

		if (!result) {
			alert("The browser blocked the copy action for some reason.");
		}

		if (activeElement) {
				// refocus the previously active element, since we stole the
				// focus to copy the text from the temp textarea
			activeElement.focus();
		}
	}
});
