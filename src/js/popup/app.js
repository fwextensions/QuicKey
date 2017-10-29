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
	_
) {
	const MinScore = .15,
		NearlyZeroScore = .05,
		MaxItems = 10,
		MinItems = 3,
		MinScoreDiff = .4,
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
		bookmarksPromise: null,
		historyPromise: null,
		resultsList: null,


			// keydown handling is managed in another module
		onKeyDown: handleKeys,


		getInitialState: function()
		{
			var query = this.props.initialQuery;

			return {
				query: query,
				matchingItems: this.getMatchingItems(query),
					// default to the first item being selected, in case we got
					// an initial query
				selected: 0
			};
		},


		componentWillMount: function()
		{
				// start the process of getting all the tabs.  any initial chars
				// the user might have typed as we were loading will not match
				// anything until this promise resolves and calls
				// getMatchingItems() again.
			this.loadPromisedItems(getTabs, "tabs", "");
		},


		componentDidUpdate: function()
		{
				// we only want this flag to be true through one render cycle
			this.forceUpdate = false;
		},


		getMatchingItems: function(
			query)
		{
			if (!query) {
					// short-circuit the empty query case, since quick-score now
					// returns 0.9 as the scores for an empty query
				return [];
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
			if (tab) {
				chrome.tabs.remove(tab.id);
				_.pull(this.tabs, tab);

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
			var storage = this.props.storage,
				tabIDs = storage.tabIDs,
				lastTabID;

				// if the query is empty and we have recent tabs tracked, create
				// a synthetic tab item corresponding to the previous one
			if (!item && tabIDs.length && this.mode == "tabs") {
				lastTabID = tabIDs[tabIDs.length - 2];
				item = {
					id: lastTabID,
					windowId: storage.tabsByID[lastTabID].windowID
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
			delta)
		{
			this.setSelectedIndex(this.state.selected + delta);
		},


		setSelectedIndex: function(
			index)
		{
			var length = this.state.matchingItems.length;

				// wrap around the end or beginning of the list
			index = (index + length) % length;

			this.setState({ selected: index });
		},


		setQuery: function(
			query,
			originalQuery)
		{
			this.setState({
				matchingItems: this.getMatchingItems(query),
				query: originalQuery,
				selected: 0
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
					this.setQuery(query, originalQuery);
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

			this.setQuery(query, originalQuery);
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
