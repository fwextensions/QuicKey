define(function() {
	const ProtocolPattern = /^(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=)?(https?|file):\/\/(www\.)?/,
		FaviconURL = "chrome://favicon/";


	return function addURLs(
		item)
	{
			// look up the favicon via chrome://favicon if the item itself
			// doesn't have one.  we want to prioritize the item's URL
			// since The Great Suspender creates faded favicons and stores
			// them as data URIs in item.favIconUrl.
		item.faviconURL = item.favIconUrl || FaviconURL + (item.unsuspendURL || item.url);
		item.displayURL = unescape(item.url.replace(ProtocolPattern, ""));
	}
});
