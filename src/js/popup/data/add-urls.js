define([
	"lib/decode"
], function(
	decode
) {
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
			item.originalURL = url;
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
			// show in the item.  replace the +s with %20 to try to make
			// decodeURIComponent happier and remove the protocol.
		item.displayURL = decode(url.replace(/\+/g, "%20"))
			.replace(ProtocolPattern, "");

			// closed tabs will have recentBoost already set.  this is mostly to
			// add a default value for bookmarks and history.
		item.recentBoost = isNaN(item.recentBoost) ? 1 : item.recentBoost;

		return item;
	}
});
