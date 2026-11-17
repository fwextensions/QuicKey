import decode from "@/lib/decode";
import {IsFirefox} from "@/background/constants";


	// assume any extension URL that begins with suspended.html is from TGS
const SuspendedURLPattern = /^chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=(.+)$/;
const ProtocolPattern = /^((chrome-extension:\/\/[^/]+\/suspended\.html#(?:.*&)?uri=)?(https?|file|chrome):\/\/(www\.)?)|(chrome-extension:\/\/[^/]+\/)/;
const FirefoxToolPattern = /\/mozapps\//;
const TGSIconPath = "chrome-extension://klbibkeccnjlkjkiokjodocebajanakg/img/";
const DefaultFaviconPath = "img/default-favicon.svg";
const FaviconURLPrefix = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=`;


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

			// in FF, which has no _favicon API, fall back to a default icon,
			// as bookmarks and history items don't show favicons, annoyingly.
		const fallbackURL = IsFirefox
			? DefaultFaviconPath
			: FaviconURLPrefix + (item.unsuspendURL || url);

			// prioritize the item's own favicon, since it reflects icons that
			// pages set dynamically, like Google Docs vs. Sheets vs. Slides,
			// which all share a host and so all get the Docs icon from
			// _favicon.  The Great Suspender also stores faded favicons there
			// as data URIs.  but sometimes TGS seems to put its own icon in
			// there if the background page wasn't available, so use the
			// fallback in that case.  some sites block their favicon from
			// loading in the popup via cross-origin-resource-policy, so
			// ResultsListItem switches to fallbackFaviconURL if it fails.
		if (favIconUrl && favIconUrl.indexOf(TGSIconPath) != 0) {
			item.faviconURL = favIconUrl;
			item.fallbackFaviconURL = fallbackURL;
		} else {
			item.faviconURL = fallbackURL;
		}
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
