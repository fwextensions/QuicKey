define([
	"react",
	"jsx!./search-box",
	"jsx!./results-list",
	"jsx!./results-list-item",
	"cp",
	"score-items",
	"get-tabs",
	"get-bookmarks",
	"get-history",
	"add-urls",
	"handle-keys",
	"recent-tabs",
	"lodash"
], function(
	React,
	SearchBox,
	ResultsList,
	ResultsListItem,
	cp,
	scoreItems,
	getTabs,
	getBookmarks,
	getHistory,
	addURLs,
	handleKeys,
	recentTabs,
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
		IsMac = /Mac/i.test(navigator.platform),
		ShortcutModifier = IsMac ? "Control" : "Alt",
		WhitespacePattern = /\s/g,
		BookmarksQuery = "/b ",
		HistoryQuery = "/h ",
		BQuery = "/b",
		HQuery = "/h",
		CommandQuery = "/";


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
		resultsList: null,


		getInitialState: function()
		{
			var query = this.props.initialQuery;

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
				.then(function(data) {
					return this.loadPromisedItems(function() { return getTabs(data.tabs) }, "tabs", "")
						.then(function(tabs) {
							data.tabs = tabs;

							return data;
						});
				}.bind(this))
				.then(function(data) {
					var tabs = data.tabs,
						recentTabs = data.recentTabs,
						recentTabsByID = data.recentTabsByID,
						now = Date.now();

						// boost the scores of recent tabs
					tabs.forEach(function(tab) {
						var recentTab = recentTabsByID[tab.id],
							age,
							hours;

						if (recentTab) {
							age = now - recentTab.recent;

							if (age < VeryRecentMS) {
								tab.recentBoost = 1 + VeryRecentBoost;
							} else if (age < RecentMS) {
								hours = Math.floor(age / HourMS);
								tab.recentBoost = 1 +
									RecentBoost * ((HourCount - hours) / HourCount);
							}
						}
					});

						// set the query again because we may have already
						// rendered a match on the tabs without the recent boosts,
						// which may have changed the results
					this.setQuery(this.state.query);

					return this.loadPromisedItems(function() {
						return getTabs(recentTabs)
							.then(function(recents) {
									// before returning the recents, we need to run scoreItems() on
									// them so that the hitMask and scores keys are added to them.
									// we don't for regular tabs because in getMatchingItems(), those
									// always get scoreItems() called on them before they're rendered.
								scoreItems(recents, "");

								return recents;
							});
					}, "recents", "");
				}.bind(this))
				.then(function() {
					var initialShortcuts = this.props.initialShortcuts;

						// after the recent tabs have been loaded and scored,
						// apply any shortcuts that recorded during init
					if (initialShortcuts.length) {
						initialShortcuts.forEach(function(shortcut) {
							if (shortcut == "w") {
								this.modifySelected(1, true);
							} else if (shortcut == "W") {
								this.modifySelected(-1, true);
							}
						}, this);
					}
				}.bind(this));
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
					// short-circuit the empty query case, since quick-score now
					// returns 0.9 as the scores for an empty query
				return this.recents;
			}

					// remove spaces from the query before scoring the items
			var scores = scoreItems(this[this.mode], query.replace(WhitespacePattern, "")),
				firstScoresDiff = (scores.length > 1 && scores[0].score > MinScore) ?
					(scores[0].score - scores[1].score) : 0;
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
				var updateData = { active: true };

				if (unsuspend && tab.unsuspendURL) {
						// change to the unsuspended URL
					updateData.url = tab.unsuspendURL;
				}

					// switch to the selected tab
				chrome.tabs.update(tab.id, updateData);

					// make sure that tab's window comes forward
				if (tab.windowId != chrome.windows.WINDOW_ID_CURRENT) {
					chrome.windows.update(tab.windowId, { focused: true });
				}
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
			}
		},


		moveTab: function(
			tab,
			direction,
			unsuspend)
		{
			var self = this;

				// get the current active tab, in case the user had closed the
				// previously active tab
			cp.tabs.query({
				active: true,
				currentWindow: true
			})
				.then(function(activeTabs) {
					var activeTab = activeTabs[0],
							// if the active tab is at 0, and we want to move
							// another tab to the left of it, force that index
							// to be 0, which shifts the active tab to index: 1
						index = Math.max(0, activeTab.index + direction);

						// if the moved tab is in the same window and is to the
						// left of the active one and the user wants to move it
						// to the right, then just set index to the active tab's
						// position, since removing the moved tab will shift the
						// active one to the left.  or if the user wants to move
						// a tab from another window to the active tab's left,
						// use its index, which will shift it to the right of the
						// moved tab.
					if ((tab.windowId == activeTab.windowId && tab.index < activeTab.index && direction > 0) ||
							direction < 0) {
						index = activeTab.index;
					}

					cp.tabs.move(tab.id, {
						windowId: activeTab.windowId,
						index: index
					})
						.then(function(movedTab) {
								// use the movedTab from this callback, since
								// the tab reference we had to it from before is
								// likely stale.  we also have to call addURLs()
								// on this new tab reference so it gets the
								// unsuspendURL added to it if necessary, so that
								// unsuspending it will work.
							addURLs(movedTab);
							self.focusTab(movedTab, unsuspend);
						});
				});
		},


		openItem: function(
			item,
			shiftKey,
			altKey)
		{
			var recents = this.recents,
				lastTab;

				// if the query is empty and we have recent tabs tracked, create
				// a synthetic tab item corresponding to the previous one
			if (!item && recents.length > 1 && this.mode == "tabs") {
				lastTab = recents[recents.length - 2];
				item = {
					id: lastTab.id,
					windowId: lastTab.windowId
				};
			}

			if (item) {
				if (this.mode == "tabs") {
						// switch to the tab
					this.focusTab(item, shiftKey);
				} else if (shiftKey) {
						// open in a new window
					chrome.windows.create({ url: item.url });
				} else if (altKey) {
						// open in a new tab
					chrome.tabs.create({ url: item.url });
				} else {
						// open in the same tab
					chrome.tabs.update({ url: item.url });
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
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
			this.setState({
				matchingItems: this.getMatchingItems(query || originalQuery),
				query: originalQuery,
				selected: query ? 0 : -1
			});
		},


		clearQuery: function()
		{
			var query = this.state.query;

			if (!query) {
					// pressing esc in an empty field should close the popup
				window.close();
			} else {
					// there's a default behavior where pressing esc in
					// a search field clears the input, but we want to
					// control what it gets cleared to
				event.preventDefault();

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


		handleListRef: function(
			resultsList)
		{
			this.resultsList = resultsList;
		},


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


			// keydown handling is managed in another module
		onKeyDown: handleKeys,


		onKeyUp: function(
			event)
		{
			if (event.key == ShortcutModifier) {
				if (!this.gotModifierUp && this.state.selected > -1) {
					this.openItem(this.state.matchingItems[this.state.selected]);
				}

				this.gotModifierUp = true;
			}
		},


		render: function()
		{
			var state = this.state,
				query = state.query;

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
					ItemComponent={ResultsListItem}
					items={state.matchingItems}
					query={query}
					maxItems={MaxItems}
					selectedIndex={state.selected}
					setSelectedIndex={this.setSelectedIndex}
					onItemClicked={this.openItem}
				/>
			</div>
		}
	});


	return App;
});
