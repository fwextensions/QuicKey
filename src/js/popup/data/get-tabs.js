define([
	"bluebird",
	"./add-urls",
	"cp",
	"lodash"
], function(
	Promise,
	addURLs,
	cp,
	_
) {
	const TitlePattern = /ttl=([^&]+)/;
	const BadTGSTitlePattern = /^chrome-extension:\/\/[^/]+\/suspended\.html#ttl=([^&]+)/;


	function decode(
		string)
	{
		var result = string;

			// try to use decodeURIComponent() to unescape the ttl param, which
			// sometimes throws if it doesn't like the encoding
		try {
			result = decodeURIComponent(string);
		} catch (e) {
			try {
				result = unescape(string);
			} catch (e) {}
		}

		return result;
	}


	const indexDuplicateTitles = (() => {
		const windows = {};

		return tab => {
			const {title, windowId} = tab;
			const window = (windows[windowId] = (windows[windowId] || {}));
			const tabsWithSameTitle = (window[title] = window[title] || []);
			const {length} = tabsWithSameTitle;

			if (length) {
				if (length == 1) {
					tabsWithSameTitle[0].title = `1) ${title}`;
				}

				tab.title = `${length + 1}) ${title}`;
			}

			tabsWithSameTitle.push(tab);
		}
	})();


	return function getTabs(
		tabsPromise)
	{
		return Promise.all([
			tabsPromise,
			cp.tabs.query({
				active: true,
				currentWindow: true
			})
		])
			.spread(function(tabs, activeTabs) {
					// there should normally be an active tab, unless we've
					// refreshed the open popup via devtools, which seemed to
					// return a normal active tab in Chrome pre-65.  default to
					// an empty object so the .id access below won't throw
					// an exception.
				const activeTab = activeTabs[0] || {};
				let match;

				tabs.forEach(function(tab) {
					addURLs(tab);

						// if the tab is suspended, check if it it's in the bad
						// state where The Great Suspender hasn't updated its
						// title so it just says "Suspended Tab".  or in more
						// recent builds, it sometimes shows the chrome-extension
						// URL as the title, with spaces instead of %20.  in
						// these cases, pull the title from the ttl param that
						// TGS puts in the URL.
					if (tab.unsuspendURL && (tab.title == "Suspended Tab" ||
							BadTGSTitlePattern.test(tab.title))) {
						match = tab.url.match(TitlePattern);

						if (match) {
							tab.title = decode(match[1]);
						}
					}

					indexDuplicateTitles(tab);
				});

					// remove the active tab from the array so it doesn't show
					// up in the results, making it clearer if you have duplicate
					// tabs open.  but do this after processing all the tabs, so
					// that if the current tab has the same title as another in
					// the same window, the indexes displayed for the other tabs
					// will be correct.
				_.remove(tabs, { id: activeTab.id });

				return tabs;
			});
	}
});
