define("popup/app", [
	"react",
	"jsx!./search-box",
	"jsx!./results-list",
	"jsx!./results-list-item",
	"jsx!./message-item",
	"cp",
	"./score/score-items",
	"./data/get-tabs",
	"./data/get-bookmarks",
	"./data/get-history",
	"./data/add-urls",
	"./shortcuts/popup-shortcuts",
	"lib/handle-ref",
	"lib/copy-to-clipboard",
	"background/recent-tabs",
	"background/settings",
	"background/constants",
	"lodash"
], function(
	React,
	SearchBox,
	ResultsList,
	ResultsListItem,
	MessageItem,
	cp,
	scoreItems,
	getTabs,
	getBookmarks,
	getHistory,
	addURLs,
	shortcuts,
	handleRef,
	copyTextToClipboard,
	recentTabs,
	settings,
	k,
	_
) {
	const MinScore = .15,
		NearlyZeroScore = .05,
		MaxItems = 10,
		MinItems = 3,
		MinScoreDiff = .4,
		VeryRecentMS = 5 * 1000,
		HourMS = 60 * 60 * 1000,
		HourCount = 3 * 24,
		RecentMS = HourCount * HourMS,
		VeryRecentBoost = .15,
		RecentBoost = .1,
		ClosedPenalty = .98,
		BookmarksQuery = "/b ",
		HistoryQuery = "/h ",
		BQuery = "/b",
		HQuery = "/h",
		CommandQuery = "/",
		NoRecentTabsMessage = [{
			message: "Recently used tabs will appear here as you continue browsing",
			faviconURL: "img/alert.svg",
			component: MessageItem
		}];


	var App = React.createClass({
		mode: "tabs",
		forceUpdate: false,
		tabs: [],
		bookmarks: [],
		history: [],
		recents: [],
		bookmarksPromise: null,
		historyPromise: null,
		gotModifierUp: false,
		gotMRUKey: true,
		mruModifier: "Alt",
		resultsList: null,
		settings: settings.getDefaults(),


		getInitialState: function()
		{
			var props = this.props,
				query = props.initialQuery;

			settings.get()
				.bind(this)
				.then(function(settings) {
					this.settings = settings;
					this.mruModifier = settings.chromeShortcuts.popupModifierEventName;
					shortcuts.update(settings);
				});

			return {
				query: query,
				matchingItems: this.getMatchingItems(query),
					// default to the first item being selected if we got an
					// initial query
				selected: query ? 0 : -1
			};
		},


		componentWillMount: function()
		{
			recentTabs.getAll()
				.bind(this)
				.then(function(tabs) {
					var now = Date.now();

						// boost the scores of recent tabs
					tabs.forEach(function(tab) {
						var age,
							hours;

						if (tab.sessionId) {
								// penalize matching closed tabs
							tab.recentBoost = ClosedPenalty;
						} else if (tab.lastVisit) {
							age = now - tab.lastVisit;

							if (age < VeryRecentMS) {
								tab.recentBoost = 1 + VeryRecentBoost;
							} else if (age < RecentMS) {
								hours = Math.floor(age / HourMS);
								tab.recentBoost = 1 +
									RecentBoost * ((HourCount - hours) / HourCount);
							}
						}
					});

					return this.loadPromisedItems(function() {
						return getTabs(tabs)
							.then(function(tabs) {
									// run scoreItems() on the tabs so that the
									// hitMask and scores keys are added to each
								scoreItems(tabs, "");

								return tabs;
							});
					}, "tabs", "");
				})
				.then(function(tabs) {
					var initialShortcuts = this.props.initialShortcuts;

						// filter out just recent and closed tabs that we
						// have a last visit time for
					this.recents = tabs
						.filter(function(tab) { return tab.lastVisit })
						.sort(function(a, b) {
								// sort open tabs before closed ones, and
								// newer before old
							if ((a.sessionId && b.sessionId) || (!a.sessionId && !b.sessionId)) {
								return b.lastVisit - a.lastVisit;
							} else if (a.sessionId) {
								return 1;
							} else {
								return -1;
							}
						});

					if (!this.recents.length) {
						this.recents = NoRecentTabsMessage;
					}

						// set the query again because we may have already
						// rendered a match on the tabs without the recent boosts,
						// which may have changed the results
					this.setQuery(this.state.query);

						// after the recent tabs have been loaded and scored,
						// apply any shortcuts that were recorded during init
					if (initialShortcuts.length) {
						const shiftMRUKey = this.settings.shortcuts[k.Shortcuts.MRUSelect];
						const mruKey = shiftMRUKey.toLocaleLowerCase();

						initialShortcuts.forEach(function(shortcut) {
							if (shortcut == mruKey) {
								this.modifySelected(1, true);
							} else if (shortcut == shiftMRUKey) {
								this.modifySelected(-1, true);
							}
						}, this);
					}

					this.props.tracker.set("metric1", tabs.length);
				});
		},


		componentDidUpdate: function()
		{
				// we only want this flag to be true through one render cycle
			this.forceUpdate = false;
		},


		getMatchingItems: function(
			query)
		{
			if (this.mode == "command" || query == BookmarksQuery || query == HistoryQuery) {
				return [];
			} else if (!query && this.mode == "tabs") {
				return this.recents;
			}

			var scores = scoreItems(this[this.mode], query),
				firstScoresDiff = (scores.length > 1 && scores[0].score > MinScore) ?
					(scores[0].score - scores[1].score) : 0,
					// drop barely-matching results, keeping a minimum of 3,
					// unless there's a big difference in scores between the
					// first two items, which may mean we need a longer tail
				matchingItems = _.dropRightWhile(scores, function(item, i) {
					return item.score < NearlyZeroScore ||
						(item.score < MinScore && (i + 1 > MinItems || firstScoresDiff > MinScoreDiff));
				});

			return matchingItems;
		},

		focusTab: function(
			tab,
			unsuspend)
		{
			if (tab) {
				var updateData = { active: true },
					queryLength = this.state.query.length,
					category = queryLength ? "tabs" : "recents",
					event = (category == "recents" && this.gotMRUKey) ?
						"focus-mru" : "focus";

				if (unsuspend && tab.unsuspendURL) {
						// change to the unsuspended URL
					updateData.url = tab.unsuspendURL;
					event = "unsuspend";
				}

				// make sure that tab's window comes forward
				chrome.windows.update(tab.windowId, { focused: true });

				// switch to the selected tab
				chrome.tabs.update(tab.id, updateData);

				this.props.tracker.event(category, event,
					queryLength ? queryLength : undefined);
			}
		},


		closeTab: function(
			tab)
		{
				// we can only remove actual tabs
			if (tab && this.mode == "tabs") {
				chrome.tabs.remove(tab.id);
				_.pull(this.tabs, tab);
				_.remove(this.recents, { id: tab.id });

					// update the list to show the remaining matching tabs
				this.setState({
					matchingItems: this.getMatchingItems(this.state.query)
				});
				this.props.tracker.event(this.state.query ? "tabs" : "recents", "close");
			}
		},


		moveTab: function(
			tab,
			direction,
			unsuspend)
		{
				// get the current active tab, in case the user had closed the
				// previously active tab
			cp.tabs.query({
				active: true,
				currentWindow: true
			})
				.bind(this)
				.then(function(activeTabs) {
					const activeTab = activeTabs[0];
						// if the active tab is at 0, and we want to move
						// another tab to the left of it, force that index
						// to be 0, which shifts the active tab to index: 1
					let index = Math.max(0, activeTab.index + direction);


					if (tab.windowId == activeTab.windowId) {
						if (index == tab.index) {
								// the tab's already where the user is trying to
								// move it, so do nothing
							return;
						} else if (tab.index < activeTab.index && direction > 0) {
								// the moved tab is in the same window and is
								// to the left of the active one and the user
								// wants to move it to the right, so just set
								// index to the active tab's position, since
								// removing the moved tab will shift the active
								// one's index to the left before the moved one
								// is re-inserted
							index = activeTab.index;
						}
					} else if (direction < 0) {
							// the user wants to move a tab from another window
							// to the active tab's left, so use its index, which
							// will shift it to the right of the moved tab
						index = activeTab.index;
					}

					return cp.tabs.move(tab.id, {
						windowId: activeTab.windowId,
						index: index
					})
				})
				.then(function(movedTab) {
						// use the movedTab from this callback, since
						// the tab reference we had to it from before is
						// likely stale.  we also have to call addURLs()
						// on this new tab reference so it gets the
						// unsuspendURL added to it if necessary, so that
						// unsuspending it will work.
					addURLs(movedTab);

					this.focusTab(movedTab, unsuspend);
					this.props.tracker.event(this.state.query.length ? "tabs" : "recents",
						"move-" + (direction ? "right" : "left"));
				});
		},


		openItem: function(
			item,
			shiftKey,
			altKey)
		{
			if (item) {
				if (this.mode == "tabs") {
					if (item.sessionId) {
							// this is a closed tab, so restore it
						chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { focused: true });
						chrome.sessions.restore(item.sessionId);
						this.props.tracker.event("tabs", "restore");
					} else {
							// switch to the tab
						this.focusTab(item, shiftKey);
					}
				} else if (shiftKey) {
						// open in a new window
					chrome.windows.create({ url: item.url });
					this.props.tracker.event(this.mode, "open-new-win");
				} else if (altKey) {
						// open in a new tab
					chrome.tabs.create({ url: item.url });
					this.props.tracker.event(this.mode, "open-new-tab");
				} else {
						// open in the same tab
					chrome.tabs.update({ url: item.url });
					this.props.tracker.event(this.mode, "open");
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
			}
		},


		copyItemURL: function(
			item,
			includeTitle)
		{
			if (item) {
				const text = (includeTitle ? item.title + "\n" : "") +
					(item.unsuspendURL || item.url);

				copyTextToClipboard(text);
			}
		},


		modifySelected: function(
			delta,
			mruKey)
		{
			this.setSelectedIndex(this.state.selected + delta, mruKey);
		},


		setSelectedIndex: function(
			index,
			mruKey)
		{
			var length = this.state.matchingItems.length;

			if (mruKey) {
					// let the selected value go to -1 when using the MRU key to
					// navigate up, and don't wrap at the end of the list
				index = Math.min(Math.max(-1, index), length - 1);
				this.gotModifierUp = false;
				this.gotMRUKey = true;
			} else {
					// wrap around the end or beginning of the list
				index = (index + length) % length;
			}

			this.setState({ selected: index });
		},


		setQuery: function(
			originalQuery,
			query)
		{
			var queryToMatch = query || originalQuery;

			this.setState({
				matchingItems: this.getMatchingItems(queryToMatch),
				query: originalQuery,
				selected: queryToMatch ? 0 : -1
			});
		},


		clearQuery: function()
		{
			var query = this.state.query;

			if (!query || this.settings[k.EscBehavior.Key] == k.EscBehavior.Close) {
					// pressing esc in an empty field should close the popup
				this.props.port.postMessage("closedByEsc");
				window.close();
			} else {
					// if we're searching for bookmarks or history,
					// reset the query to just /b or /h, rather than
					// clearing it, unless it's already that, in which
					// case, clear it
				if (this.mode == "tabs" || this.mode == "command" ||
						query == BookmarksQuery || query == HistoryQuery) {
					this.forceUpdate = true;
					query = "";
				} else if (this.mode == "bookmarks") {
					this.forceUpdate = true;
					query = BookmarksQuery;
				} else if (this.mode == "history") {
					this.forceUpdate = true;
					query = HistoryQuery;
				}

					// scroll the list back to the first row, which wouldn't
					// happen by default if we just cleared the query, since in
					// that case there's no selected item to scroll to
				this.resultsList.scrollToRow(0);
				this.onQueryChange({ target: { value: query }});
			}
		},


		loadPromisedItems: function(
			loader,
			itemName,
			commandPattern)
		{
			var promiseName = itemName + "Promise";

			if (!this[promiseName]) {
					// store the promise so we only load the items once
				this[promiseName] = loader().then(function(items) {
						// strip the /b|h from the typed query
					var originalQuery = this.state.query,
						query = originalQuery.slice(commandPattern.length);

						// store the result and then update the results list with
						// the match on the existing query
					this[itemName] = items;
					this.setQuery(originalQuery, query);

					return items;
				}.bind(this));
			}

			return this[promiseName];
		},


		handleListRef: handleRef("resultsList"),


		onQueryChange: function(
			event)
		{
			var query = event.target.value,
					// remember the original typed value in case it matches a
					// special mode below and we have to trip out the / part in
					// order to match the items against it
				originalQuery = query;

			if (query.indexOf(BookmarksQuery) == 0) {
				this.mode = "bookmarks";
				query = query.slice(BookmarksQuery.length);

				if (!this.bookmarks.length) {
						// we haven't fetched the bookmarks yet, so load them
						// and then call getMatchingItems() after they're ready
					this.loadPromisedItems(getBookmarks, "bookmarks", BookmarksQuery);
				}
			} else if (query.indexOf(HistoryQuery) == 0) {
				this.mode = "history";
				query = query.slice(HistoryQuery.length);

				if (!this.history.length) {
					this.loadPromisedItems(getHistory, "history", HistoryQuery);
				}
			} else if (query == CommandQuery || query == BQuery || query == HQuery) {
					// we don't know if the user's going to type b or h, so
					// don't match any items
				this.mode = "command";
				query = "";
			} else {
				this.mode = "tabs";
			}

			this.setQuery(originalQuery, query);
		},


		onKeyDown: function(
			event)
		{
				// reset this on every keyDown so we know if the user had typed
				// an alt-W or alt-shift-W before releasing alt.  it will get set
				// to true in setSelectedIndex().
			this.gotMRUKey = false;

				// keydown handling is managed in another module
			return shortcuts.handleEvent(event, this);
		},


		onKeyUp: function(
			event)
		{
			if (event.key == this.mruModifier) {
				if (!this.gotModifierUp && this.gotMRUKey && this.state.selected > -1) {
					this.openItem(this.state.matchingItems[this.state.selected]);
				}

				this.gotModifierUp = true;
				this.gotMRUKey = false;
			}
		},


		render: function()
		{
			var state = this.state,
				query = state.query,
				items = state.matchingItems;

			return <div className={this.props.platform}>
				<SearchBox
					mode={this.mode}
					forceUpdate={this.forceUpdate}
					query={query}
					onChange={this.onQueryChange}
					onKeyDown={this.onKeyDown}
					onKeyUp={this.onKeyUp}
				/>
				<ResultsList
					ref={this.handleListRef}
					items={items}
					maxItems={MaxItems}
					itemComponent={ResultsListItem}
					mode={this.mode}
					query={query}
					selectedIndex={state.selected}
					setSelectedIndex={this.setSelectedIndex}
					onItemClicked={this.openItem}
					onTabClosed={this.closeTab}
				/>
			</div>
		}
	});


	return App;
});
