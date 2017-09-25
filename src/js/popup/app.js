define([
	"react",
	"jsx!./search-box",
	"jsx!./results-list",
	"jsx!./results-list-item",
	"cp",
	"array-score",
	"quick-score",
	"simple-score",
	"get-bookmarks",
	"get-history",
	"check-modifiers",
	"lodash"
], function(
	React,
	SearchBox,
	ResultsList,
	ResultsListItem,
	cp,
	arrayScore,
	quickScore,
	simpleScore,
	getBookmarks,
	getHistory,
	checkModifiers,
	_
) {
	const MinScore = .15,
		NearlyZeroScore = .05,
		MaxItems = 10,
		MinItems = 3,
		MinScoreDiff = .4,
		MaxQueryLength = 25,
		BookmarksQuery = "/b ",
		BookmarksQueryPattern = new RegExp("^" + BookmarksQuery),
		HistoryQuery = "/h ",
		HistoryQueryPattern = new RegExp("^" + HistoryQuery),
		BHQueryPattern = /^\/[bh]$/,
		CommandQuery = "/",
		IsWindows = /Win/i.test(navigator.platform);


		// use title and url as the two keys to score
	const quickScoreArray = arrayScore(quickScore, ["title", "displayURL"]),
		simpleScoreArray = arrayScore(simpleScore, ["title", "displayURL"]);


	var TabSelector = React.createClass({
		mode: "tabs",
		forceUpdate: false,
		bookmarks: null,
		history: null,
		bufferedQuery: "",
		resultsList: null,


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


		componentDidUpdate: function()
		{
				// we only want this to be true through one render cycle
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

			var mode = this.mode,
				items = mode == "tabs" ? this.props.tabs :
					mode == "bookmarks" ? this.bookmarks : this.history,
				scorer = query.length <= MaxQueryLength ? quickScoreArray : simpleScoreArray,
				scores = scorer(items, query),
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
				_.pull(this.props.tabs, tab);

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

				// get the current active tab, in case the user had closed it
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
								// likely stale
							self.focusTab(movedTab, unsuspend);
						});
				});
		},


		openItem: function(
			item,
			shiftKey,
			altKey)
		{
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


		setStateFromQuery: function(
			strings)
		{
			this.setState({
				matchingItems: this.getMatchingItems(strings[0]),
				query: strings[1],
				selected: 0
			});
		},


		loadPromisedItems: function(
			itemName,
			originalQuery,
			forcedQuery,
			forcedQueryPattern,
			loader)
		{
				// default the buffer to the query we've captured so far
			this.bufferedQuery = this.bufferedQuery || originalQuery;

				// force the input to update to show just /b or /h
			this.forceUpdate = true;
			this.setState({
				query: forcedQuery
			});

				// if the bookmarks or history are null, set them to the promise
				// returned from the loader function so we only call it once
			if (!this[itemName]) {
				this[itemName] = loader().then(function(items) {
					var bufferedQuery = this.bufferedQuery;

						// store the result
					this[itemName] = items;

						// force the input to update with the buffered string
						// when the query state is set by setStateFromQuery()
						// after we return
					this.forceUpdate = true;
					this.bufferedQuery = "";

						// strip the /b or /h out of the buffered query again
					return [bufferedQuery.replace(forcedQueryPattern, ""), bufferedQuery];
				}.bind(this));
			}

				// return the promise
			return this[itemName];
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

			if (BookmarksQueryPattern.test(query)) {
				this.mode = "bookmarks";
				query = query.replace(BookmarksQueryPattern, "");

					// we haven't fetched the bookmarks yet or are in the process,
					// so this method will force the search box to just show /b
					// and return a promise that will resolve to the bookmarks
				if (!this.bookmarks || this.bookmarks instanceof Promise) {
					this.loadPromisedItems("bookmarks", originalQuery, BookmarksQuery,
							BookmarksQueryPattern, getBookmarks)
						.then(this.setStateFromQuery);

					return;
				}
			} else if (HistoryQueryPattern.test(query)) {
				this.mode = "history";
				query = query.replace(HistoryQueryPattern, "");

					// same as bookmarks branch above
				if (!this.history || this.history instanceof Promise) {
					this.loadPromisedItems("history", originalQuery, HistoryQuery,
							HistoryQueryPattern, getHistory)
						.then(this.setStateFromQuery);

					return;
				}
			} else if (query == CommandQuery || BHQueryPattern.test(query)) {
					// we don't know if the user's going to type b or h, so
					// don't match any items
				this.mode = "command";
				query = "";
			} else {
				this.mode = "tabs";
			}

			this.setStateFromQuery([query, originalQuery]);
		},


		onKeyDown: function(
			event)
		{
			var query = event.target.value,
				state = this.state,
				selectedTab = state.matchingItems[state.selected];

			switch (event.key) {
				case "Escape":
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
					break;

				case "ArrowUp":
					this.modifySelected(-1);
					event.preventDefault();
					break;

				case "ArrowDown":
					this.modifySelected(1);
					event.preventDefault();
					break;

				case "PageDown":
					this.resultsList.scrollByPage("down");
					event.preventDefault();
					break;

				case "PageUp":
					this.resultsList.scrollByPage("up");
					event.preventDefault();
					break;

				case "Home":
					this.setSelectedIndex(0);
					event.preventDefault();
					break;

				case "End":
					this.setSelectedIndex(this.state.matchingItems.length - 1);
					event.preventDefault();
					break;

				case "Enter":
					this.openItem(selectedTab, event.shiftKey, checkModifiers(event, "mod"));
					event.preventDefault();
					break;

				case "[":
// TODO: ctrl-shift isn't working because key == {
					if (this.mode == "tabs" && event.ctrlKey) {
						this.moveTab(selectedTab, -1, event.shiftKey);
						event.preventDefault();
					}
					break;

				case "]":
					if (this.mode == "tabs" && event.ctrlKey) {
						this.moveTab(selectedTab, 1, event.shiftKey);
						event.preventDefault();
					}
					break;

				case "W":
				case "w":
					if (this.mode == "tabs" && checkModifiers(event, "mod")) {
						this.closeTab(selectedTab);
						event.preventDefault();
					}

					// fall through to the default case so that we'll also capture
					// typed w's when bookmarks or history is loading

				default:
					if ((this.mode == "bookmarks" && this.bookmarks instanceof Promise) ||
						(this.mode == "history" && this.history instanceof Promise) &&
						key.length == 1) {
							// we're still loading the bookmarks or history, but
							// the user's still typing, so add this to the query.
							// check the key length, to make sure we're not
							// buffering a special key like Control.
						this.bufferedQuery += event.key;
					}
					break;
			}
		},


		render: function()
		{
			var state = this.state,
				query = state.query;

			return <div className={IsWindows ? "win" : ""}>
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


	return TabSelector;
});
