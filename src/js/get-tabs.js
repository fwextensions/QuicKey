define([
	"add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	const SuspendedURLPattern = /^chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=(.+)$/;


	return function getTabs()
	{
		return cp.tabs.query({})
			.then(function(tabs) {
				tabs.forEach(function(tab) {
					var url = tab.url;

						// add a URL without the Great Suspender preamble that
						// we can use with chrome://favicon/ to get the site's
						// favicon instead of the Great Suspender's, as there are
						// times it hasn't generated a faded icon for some sites.
						// we have to add that before calling addURLs() so that it
						// can use it in the faviconURL.  we also only add it if
						// the tab is suspended, so ResultsListItem can detect that
						// and fade the icon.
					if (SuspendedURLPattern.test(url)) {
						tab.unsuspendURL = url.replace(SuspendedURLPattern, "$1");
					}

					addURLs(tab);
				});

				return tabs;
			});
	}
});
