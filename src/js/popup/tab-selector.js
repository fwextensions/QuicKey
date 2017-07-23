define([
	"array-score",
	"quicksilver-score",
	"get-bookmarks",
	"react",
	"jsx!./tab-item",
	"lodash"
], function(
	arrayScore,
	qsScore,
	getBookmarks,
	React,
	TabItem,
	_
) {
	const MinScore = .2,
		MaxItems = 10,
		SuspendedURLPattern = /^chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=(.+)$/,
		ProtocolPattern = /^(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=)?(https?|file):\/\//,
		BookmarksQuery = "/b ",
		BookmarksQueryPattern = /^\/b /;


		// use title and url as the two keys to score
	var scoreArray = arrayScore(qsScore, ["title", "displayURL"]);


	var TabSelector = React.createClass({
		mode: "tabs",
		bookmarks: [],
		ignoreMouse: true,


		getInitialState: function()
		{
			var query = this.props.initialQuery;

				// add a displayURL to each tab so that we can score against it
				// in onQueryChange
			this.props.tabs.forEach(function(tab) {
// TODO: move this to main.js
				tab.displayURL = tab.url.replace(ProtocolPattern, "");
			});

			return {
				query: query,
				matchingItems: this.getMatchingItems(query),
					// default to the first item being selected, in case we got
					// an initial query
				selected: 0
			};
		},


		componentDidMount: function()
		{
			var searchBox = this.refs.searchBox,
				queryLength = searchBox.value.length;

				// even if there's a default value, the insertion point gets set
				// to the beginning of the input field, instead of at the end.
				// so move it there after the field is created.
			searchBox.setSelectionRange(queryLength, queryLength);
		},


		getMatchingItems: function(
			query)
		{
			var items = this.mode == "tabs" ? this.props.tabs : this.bookmarks,
				scores = scoreArray(items, query),
					// first limit the tabs to 10, then drop barely-matching results
				matchingItems = _.dropRightWhile(scores.slice(0, MaxItems), function(item) {
					return item.score < MinScore;
				});

			return matchingItems;
		},


		focusTab: function(
			tab,
			unsuspend)
		{
			if (tab) {
				var match = unsuspend && tab.url.match(SuspendedURLPattern),
					updateData = { active: true };

				if (unsuspend && match) {
						// change to the unsuspended URL
					updateData.url = match[1];
				}

					// switch to the selected tab
				chrome.tabs.update(tab.id, updateData);

					// make sure that tab's window comes forward
				if (tab.windowId != chrome.windows.WINDOW_ID_CURRENT) {
					chrome.windows.update(tab.windowId, { focused: true });
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
			}
		},


		openBookmark: function(
			bookmark,
			newWindow,
			newTab)
		{
			if (bookmark) {
				if (newWindow) {
					chrome.windows.create({ url: bookmark.url });
				} else if (newTab) {
					chrome.tabs.create({ url: bookmark.url });
				} else {
					chrome.tabs.update({ url: bookmark.url });
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
			}
		},


		modifySelected: function(
			delta)
		{
			var selected = this.state.selected,
				maxIndex = this.state.matchingItems.length - 1;

			if (!_.isNumber(selected)) {
				if (delta > 0) {
					selected = -1;
				} else {
					selected = maxIndex;
				}
			}

			this.setSelectedIndex(selected + delta);
		},


		setSelectedIndex: function(
			selected,
			fromMouse)
		{
			var maxIndex = this.state.matchingItems.length - 1;

			if (!fromMouse || !this.ignoreMouse) {
				selected = Math.min(Math.max(0, selected), maxIndex);
				this.setState({selected: selected});
			}
		},


		onQueryChange: function(
			event)
		{
			var query = event.target.value,
				queryString = query,
				matchingItems,
				promise = Promise.resolve(),
				self = this;

			if (BookmarksQueryPattern.test(query)) {
				this.mode = "bookmarks";
				query = query.replace(BookmarksQueryPattern, "");
			}

			if (this.mode == "bookmarks" && !this.bookmarks.length) {
				promise = getBookmarks().then(function(bookmarks) {
					self.bookmarks = bookmarks;
				});
			}

			promise.then(function() {
				matchingItems = self.getMatchingItems(query);

				self.setState({
					query: queryString,
					matchingItems: matchingItems,
					selected: 0
				});
			});
		},


		onMouseMove: function(
			event)
		{
			this.ignoreMouse = false;
		},


		onKeyDown: function(
			event)
		{
			var searchBox = this.refs.searchBox,
				query = searchBox.value,
				state = this.state;

			switch (event.which) {
				case 27:	// escape
					if (!query) {
							// pressing esc in an empty field should close the popup
						window.close();
					} else {
							// there's a default behavior where pressing esc
							// clears the input, but we want to control what it
							// gets cleared to
						event.preventDefault();

							// if we're searching for bookmarks, reset the query
							// to just /b, rather than clearing it, unless it's
							// already /b, in which case, clear it
						if (this.mode == "tabs" || query == BookmarksQuery) {
							query = "";
						} else {
							query = BookmarksQuery;
						}

						searchBox.value = query;
						this.onQueryChange({ target: { value: query }});
					}
					break;

				case 38:	// up arrow
					this.modifySelected(-1);
					event.preventDefault();
					break;

				case 40:	// down arrow
					this.modifySelected(1);
					event.preventDefault();
					break;

				case 13:	// enter
					if (this.mode == "tabs") {
						this.focusTab(state.matchingItems[state.selected], event.shiftKey);
					} else {
						this.openBookmark(state.matchingItems[state.selected],
							event.shiftKey, event.ctrlKey);
					}
					event.preventDefault();
					break;
			}
		},


		render: function()
		{
			var selectedIndex = this.state.selected,
				query = this.state.query,
				tabItems = this.state.matchingItems.map(function(tab, i) {
					return <TabItem
						key={tab.id}
						tab={tab}
						index={i}
						isSelected={i == selectedIndex}
						query={query}
						ignoreMouse={this.state.ignoreMouse}
						focusTab={this.focusTab}
						setSelectedIndex={this.setSelectedIndex}
						onMouseMove={this.onMouseMove}
					/>
				}, this),
					// hide the ul when the list is empty, so we don't force the
					// popup to be taller than the input when it's first opened
				listStyle = {
					display: tabItems.length ? "block" : "none"
				};

			return <div className="tab-selector">
				<input type="search"
					ref="searchBox"
					className="search-box"
					tabIndex="0"
					placeholder="Search for a tab title or URL"
					defaultValue={query}
					autoFocus={true}
					onChange={this.onQueryChange}
					onKeyDown={this.onKeyDown}
				/>
				<ul className="results-list"
					style={listStyle}
				>
					{tabItems}
				</ul>
			</div>
		}
	});


	return TabSelector;
});
