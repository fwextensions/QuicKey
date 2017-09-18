define(function() {
	function copyTextToClipboard(
		text)
	{
		var copyFrom = document.createElement("textarea"),
			body = document.body,
			result;

		copyFrom.textContent = text;
		body.appendChild(copyFrom);
		copyFrom.focus();
		copyFrom.select();
		result = document.execCommand("copy");
		body.removeChild(copyFrom);

		if (!result) {
			alert("The browser blocked the copy action for some reason.");
		}
	}


	return copyTextToClipboard;
});
