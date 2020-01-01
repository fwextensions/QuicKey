define(function() {
		// assume any extension URL that begins with suspended.html is from TGS
	const SuspendedURLPattern = /^chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=(.+)$/;
	const ProtocolPattern = /^((chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=)?(https?|file|chrome):\/\/(www\.)?)|(chrome-extension:\/\/[^/]+\/)/;
	const TGSIconPath = "chrome-extension://klbibkeccnjlkjkiokjodocebajanakg/img/";
	const FaviconURLPrefix = "chrome://favicon/";


	return function addURLs(
		item,
		unsuspend)
	{
		let {url, favIconUrl} = item;
		const unsuspendURL = url.replace(SuspendedURLPattern, "$1");

		if (unsuspend) {
				// force the item to use the unsuspended version of its URL
			item.url = unsuspendURL;
			item.faviconURL = FaviconURLPrefix + (unsuspendURL);
		} else {
			if (url != unsuspendURL) {
					// add a URL without the Great Suspender preamble that we
					// can use with chrome://favicon/ to get the site's favicon
					// instead of the Great Suspender's, as there are times it
					// hasn't generated a faded icon for some sites.  we have to
					// add that before setting the faviconURL below.  we also
					// only add it if the tab is suspended, so ResultsListItem
					// can detect that and fade the icon.
				item.unsuspendURL = unsuspendURL;
			}

				// look up the favicon via chrome://favicon if the item itself
				// doesn't have one.  we want to prioritize the item's URL since
				// The Great Suspender creates faded favicons and stores them as
				// data URIs in item.favIconUrl.  except, sometimes it seems to
				// put its own icon in there if the background page wasn't
				// available, so default to the chrome:// URL in that case.
			item.faviconURL = (favIconUrl && favIconUrl.indexOf(TGSIconPath) != 0) ?
				favIconUrl : FaviconURLPrefix + (item.unsuspendURL || url);
		}

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
DEBUG && console.log(`decodeURIComponent failed on: ${url}`);

			try {
				url = unescape(url);
			} catch (e) {}
		}

		item.displayURL = url.replace(ProtocolPattern, "");

			// closed tabs will have recentBoost already set.  this is mostly to
			// add a default value for bookmarks and history.
		item.recentBoost = isNaN(item.recentBoost) ? 1 : item.recentBoost;
	}
});
