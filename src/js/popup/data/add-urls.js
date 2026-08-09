import decode from "@/lib/decode";
import {IsFirefox} from "@/background/constants";


	// assume any extension URL that begins with suspended.html is from TGS
const SuspendedURLPattern = /^chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=(.+)$/;
const ProtocolPattern = /^((chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=)?(https?|file|chrome):\/\/(www\.)?)|(chrome-extension:\/\/[^/]+\/)/;
const FirefoxToolPattern = /\/mozapps\//;
const TGSIconPath = "chrome-extension://klbibkeccnjlkjkiokjodocebajanakg/img/";
const DefaultFaviconPath = "img/default-favicon.svg";
const FaviconURLPrefix = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=`;
const RemoteFaviconPattern = /^https?:/;


export default function addURLs(
	item,
	unsuspend)
{
	let {url, favIconUrl} = item;
	const unsuspendURL = url.replace(SuspendedURLPattern, "$1");

	if (unsuspend) {
			// force the item to use the unsuspended version of its URL
		item.url = unsuspendURL;
		item.originalURL = url;
		item.faviconURL = (IsFirefox && !favIconUrl)
			? DefaultFaviconPath
			: FaviconURLPrefix + (unsuspendURL);
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

			// look up the favicon via the _favicon API if we can't use the
			// item's own.  we want to prioritize item.favIconUrl since The
			// Great Suspender creates faded favicons and stores them there as
			// data URIs.  but only data URIs, since the popup page can't load
			// a remote http(s) favicon from a different origin.  and sometimes
			// TGS seems to put its own icon in there if the background page
			// wasn't available, so fall back to the _favicon URL in that case.
			// in FF, which has no _favicon API, use a fallback icon, as
			// bookmarks and history items don't show favicons, annoyingly.
		item.faviconURL = IsFirefox
			? (favIconUrl || DefaultFaviconPath)
			: (favIconUrl
					&& !RemoteFaviconPattern.test(favIconUrl)
					&& favIconUrl.indexOf(TGSIconPath) != 0)
				? favIconUrl
				: FaviconURLPrefix + (item.unsuspendURL || url);
	}

		// add a clean displayURL to each tab that we can score against and
		// show in the item.  replace the +s with %20 to try to make
		// decodeURIComponent happier and remove the protocol.
	item.displayURL = decode(url.replace(/\+/g, "%20"))
		.replace(ProtocolPattern, "");

		// closed tabs will have recentBoost already set.  this is mostly to
		// add a default value for bookmarks and history.
	item.recentBoost = isNaN(item.recentBoost) ? 1 : item.recentBoost;

	if (FirefoxToolPattern.test(item.faviconURL)) {
			// FF generates console errors when we try to render a favicon
			// from some of its internal pages
		item.faviconURL = DefaultFaviconPath;
	}

	return item;
}
