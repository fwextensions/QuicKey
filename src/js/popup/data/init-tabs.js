define([
	"bluebird",
	"cp",
	"lib/decode",
	"lib/load-script",
	"lodash"
], function(
	Promise,
	cp,
	decode,
	loadScript,
	_
) {
	const TitlePattern = /ttl=([^&]+)/;
	const BadTGSTitlePattern = /^chrome-extension:\/\/[^/]+\/suspended\.html#ttl=([^&]+)/;
	const WhitespacePattern = /[\u00A0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/g;
	const HourMS = 60 * 60 * 1000;
	const HourCount = 3 * 24;
	const RecentMS = HourCount * HourMS;
	const RecentBoost = .1;
	const VeryRecentMS = 5 * 1000;
	const VeryRecentBoost = .15;
	const ClosedPenalty = .98;


	function addRecentBoost(
		tab)
	{
		if (tab.sessionId) {
				// penalize matching closed tabs
			tab.recentBoost = ClosedPenalty;
		} else if (tab.lastVisit) {
			const age = Date.now() - tab.lastVisit;

			if (age < VeryRecentMS) {
				tab.recentBoost = 1 + VeryRecentBoost;
			} else if (age < RecentMS) {
				const hours = Math.floor(age / HourMS);

				tab.recentBoost = 1 +
					RecentBoost * ((HourCount - hours) / HourCount);
			}
		}
	}


	return async function initTabs(
		tabsPromise,
			// there should normally be an active tab, unless we've refreshed
			// the open popup via devtools, which seemed to return a normal
			// active tab in Chrome pre-65.  default to an empty object so the
			// .id access below won't throw an exception.
		activeTab = {},
		markTabsInOtherWindows,
		normalizeWhitespace,
		usePinyin)
	{
		let tabsByTitle = {};
		let addPinyinStrings = false;

		if (usePinyin && typeof pinyin !== "function") {
			try {
					// dynamically load the pinyin module into a global var, so
					// that it's only processed if we actually need to use it.
					// importing it as a global is ugly, but seems to be the
					// simplest solution, since a built RequireJS project can't
					// seem to do lazy-loading without including the full
					// RequireJS library, which adds extra bloat.
				await loadScript("/js/lib/pinyin.js");

					// set a flag so we know pinyin() is available and we don't
					// have to check typeof pinyin on every tab in the loop below
				addPinyinStrings = typeof pinyin == "function";
			} catch (e) {
				console.error(e);
			}
		}


		function indexDuplicateTitles(
			tab)
		{
				// don't include closed tabs, because there's no sense in which
				// they have a left to right index
			if (typeof tab.sessionId == "undefined") {
				const {title, displayURL} = tab;
					// the domain has already been stripped out of displayURL and
					// if the URL doesn't contain "/", [0] will be the whole URL
				const domainAndTitle = displayURL.split("/")[0] + title;
				const tabsWithSameTitle = (tabsByTitle[domainAndTitle] =
					tabsByTitle[domainAndTitle] || []);
				const {length} = tabsWithSameTitle;

				if (length) {
					if (length == 1) {
							// go back and set the titleIndex on the first tab,
							// now that we know other tabs have the same title
						tabsWithSameTitle[0].titleIndex = length;
					}

					tab.titleIndex = length + 1;
				}

				tabsWithSameTitle.push(tab);
			}
		}


		return tabsPromise
			.then(tabs => {
				const currentWindowID = activeTab.windowId;
				const markTabs = markTabsInOtherWindows && Number.isInteger(currentWindowID);

				tabs.forEach(tab => {
					addRecentBoost(tab);

						// don't treat closed tabs as being in other windows
					tab.otherWindow = markTabs &&
						tab.windowId !== currentWindowID && !tab.sessionId;

						// if the tab is suspended, check if it it's in the bad
						// state where The Great Suspender hasn't updated its
						// title so it just says "Suspended Tab".  or in more
						// recent builds, it sometimes shows the chrome-extension
						// URL as the title, with spaces instead of %20.  in
						// these cases, pull the title from the ttl param that
						// TGS puts in the URL.
					if (tab.unsuspendURL && (tab.title == "Suspended Tab" ||
							BadTGSTitlePattern.test(tab.title))) {
						const match = tab.url.match(TitlePattern);

						if (match) {
							tab.title = decode(match[1]);
						}
					}

					if (normalizeWhitespace) {
							// replace all non-standard spaces with a regular
							// space so that users who've enabled the option to
							// insert spaces in the query can match against
							// these titles
						tab.title = tab.title.replace(WhitespacePattern, " ");
					}

					if (addPinyinStrings) {
						const pinyinTitle = pinyin(tab.title);
						const pinyinDisplayURL = pinyin(tab.displayURL);

							// if there's no difference, just store an empty
							// string so that scoreArray() will short-circuit
							// the scoring and return 0
						tab.pinyinTitle = (pinyinTitle !== tab.title)
							? pinyinTitle
							: "";
						tab.pinyinDisplayURL = (pinyinDisplayURL !== tab.displayURL)
							? pinyinDisplayURL
							: "";
					}

					indexDuplicateTitles(tab);
				});

					// remove the active tab from the array so it doesn't show
					// up in the results, making it clearer if you have duplicate
					// tabs open.  but do this after processing all the tabs, so
					// that if the current tab has the same title as another one,
					// the indexes displayed for the other tabs will be correct.
				_.remove(tabs, { id: activeTab.id });

					// make sure this index of tabs gets GC'd
				tabsByTitle = null;

				return tabs;
			});
	}
});
