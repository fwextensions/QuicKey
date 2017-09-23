define(function() {
	const ProtocolPattern = /^(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=)?(https?|file):\/\/(www\.)?/,
		FaviconURL = "chrome://favicon/";


	return function addURLs(
		item)
	{
		var url = item.url;

			// look up the favicon via chrome://favicon if the item itself
			// doesn't have one.  we want to prioritize the item's URL
			// since The Great Suspender creates faded favicons and stores
			// them as data URIs in item.favIconUrl.
		item.faviconURL = item.favIconUrl || FaviconURL + (item.unsuspendURL || url);

			// add a clean displayURL to each tab that we can score against and
			// show in the item.  unfortunately, decodeURIComponent() will throw
			// an exception if it doesn't like how a URL is formed, which we
			// don't have any control over.  so first replace +'s with %20 and
			// then try to decode.  if that throws, try unescape(), even though
			// it's deprecated.  if unescape is ever fully removed from Chrome,
			// then url will just be left undecoded for the displayURL.
		try {
			url = url.replace(/\+/g, "%20");
			url = decodeURIComponent(url);
		} catch (e) {
			console.error("decodeURIComponent failed:", url);

			try {
				url = unescape(url);
			} catch (e) {}
		}

		item.displayURL = url.replace(ProtocolPattern, "");
	}
});
