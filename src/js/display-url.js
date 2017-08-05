define(function() {
	const ProtocolPattern = /^(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=)?(https?|file):\/\/(www\.)?/;


	function displayURL(
		url)
	{
		return unescape(url.replace(ProtocolPattern, ""));
	}


	return displayURL;
});
