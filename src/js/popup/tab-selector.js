define([
	"array-score",
	"quicksilver-score",
	"react",
	"jsx!./tab-item",
	"lodash"
], function(
	arrayScore,
	qsScore,
	React,
	TabItem,
	_
) {
	const MinScore = .2,
		MaxItems = 10,
		SuspendedURLPattern = /^chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=(.+)$/,
		ProtocolPattern = /(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#(?:.*&)?uri=)?(https?|file):\/\//;


		// use title and url as the two keys to score
	var scoreArray = arrayScore(qsScore, ["title", "displayURL"]);


	var TabSelector = React.createClass({
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
				matchingTabs: this.getMatchingTabs(query),
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


		getMatchingTabs: function(
			query)
		{
			var scores = scoreArray(this.props.tabs, query),
					// first limit the tabs to 10, then drop barely-matching results
				matchingTabs = _.dropRightWhile(scores.slice(0, MaxItems), function(item) {
					return item.score < MinScore;
				});

			return matchingTabs;
		},


		focusTab: function(
			tab,
			unsuspend)
		{
			if (tab) {
				var match = unsuspend && tab.url.match(SuspendedURLPattern),
					updateData = { active: true };

				if (unsuspend && match) {
					updateData.url = match[1];
				}

				chrome.tabs.update(tab.id, updateData);

				if (tab.windowId != chrome.windows.WINDOW_ID_CURRENT) {
					chrome.windows.update(tab.windowId, { focused: true });
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
				maxIndex = this.state.matchingTabs.length - 1;

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
			var maxIndex = this.state.matchingTabs.length - 1;

			if (!fromMouse || !this.ignoreMouse) {
				selected = Math.min(Math.max(0, selected), maxIndex);
				this.setState({selected: selected});
			}
		},


		onQueryChange: function(
			event)
		{
			var query = event.target.value,
				matchingTabs = this.getMatchingTabs(query);

			this.setState({
				query: query,
				matchingTabs: matchingTabs,
				selected: 0
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
			var searchBox = this.refs.searchBox;

			switch (event.which) {
				case 27:	// escape
					if (!searchBox.value) {
							// pressing esc in an empty field should close the popup
						window.close();
					} else {
						searchBox.value = "";
						this.onQueryChange({ target: { value: "" }});
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
					this.focusTab(this.state.matchingTabs[this.state.selected], event.shiftKey);
					event.preventDefault();
					break;
			}
		},


		render: function()
		{
			var selectedIndex = this.state.selected,
				query = this.state.query,
				tabItems = this.state.matchingTabs.map(function(tab, i) {
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
