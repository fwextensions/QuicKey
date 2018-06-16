define(function() {
		// assume any extension URL that begins with suspended.html is from TGS
	const SuspendedURLPattern = /^chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=(.+)$/,
		ProtocolPattern = /^((chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=)?(https?|file|chrome):\/\/(www\.)?)|(chrome-extension:\/\/[^/]+\/)/,
		TGSIconPath = "chrome-extension://klbibkeccnjlkjkiokjodocebajanakg/img/",
		FaviconURL = "chrome://favicon/";


	return function addURLs(
		item)
	{
		var url = item.url,
			unsuspendURL = url.replace(SuspendedURLPattern, "$1");

		if (url != unsuspendURL) {
				// add a URL without the Great Suspender preamble that we can use
				// with chrome://favicon/ to get the site's favicon instead of
				// the Great Suspender's, as there are times it hasn't generated
				// a faded icon for some sites.  we have to add that before
				// setting the faviconURL below.  we also only add it if the tab
				// is suspended, so ResultsListItem can detect that and fade the icon.
			item.unsuspendURL = unsuspendURL;
		}

			// look up the favicon via chrome://favicon if the item itself
			// doesn't have one.  we want to prioritize the item's URL
			// since The Great Suspender creates faded favicons and stores
			// them as data URIs in item.favIconUrl.  except, sometimes it seems
			// to put its own icon in there if the background page wasn't available,
			// so default to the chrome:// URL in that case.
		item.faviconURL = (item.favIconUrl && item.favIconUrl.indexOf(TGSIconPath) != 0) ?
			item.favIconUrl : FaviconURL + (item.unsuspendURL || url);

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

			// closed tabs will have recentBoost already set
		item.recentBoost = isNaN(item.recentBoost) ? 1 : item.recentBoost;
	}
});
