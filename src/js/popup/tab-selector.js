define([
	"array-score",
	"quicksilver-score",
	"react",
	"react-dom",
	"lodash"
], function(
	arrayScore,
	qsScore,
	React,
	ReactDOM,
	_
) {
	var MinScore = .2,
		MaxItems = 10;


		// use title as the key to score
	var scoreArray = arrayScore(qsScore, "title");


	var TabItem = React.createClass({
		render: function()
		{
			var title = this.props.title,
				className = this.props.isSelected ? "selected" : "";

			return <li className={className}
				key={title}
				data-index={this.props.index}
			>{title}</li>
		}
	});


	var TabSelector = React.createClass({
		getInitialState: function()
		{
			return {
				matchingTabs: [],
				selected: null
			};
		},


		onQueryChange: function(
			event)
		{
			var scores = scoreArray(this.props.tabs, event.target.value),
					// don't show barely-matching results and limit it to 10
				matchingTabs = _.dropRightWhile(scores, function(item) {
					return item.score < MinScore;
				}).slice(0, MaxItems);

			this.setState({
				matchingTabs: matchingTabs,
				selected: 0
			});
		},


		onKeyDown: function(
			event)
		{
			var searchBox;

			switch (event.which) {
				case 27:	// escape
						// clear and focus the search box so that the user can
						// press esc after clicking in the feature list, and
						// then type a new feature name
					searchBox = ReactDOM.findDOMNode(this.refs.searchBox);

					if (!searchBox.value) {
							// pressing esc in an empty field should close the popup
						window.close();
					} else {
						searchBox.value = "";
						searchBox.focus();
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
					this.focusTabByTitle(this.state.matchingTabs[this.state.selected].title);
					event.preventDefault();
					break;
			}
		},


		onClick: function(
			event)
		{
			var clickedIndex = parseInt(event.target.dataset.index);

			if (_.isNumber(clickedIndex)) {
				this.setSelectedIndex(clickedIndex);
				this.focusTabByTitle(this.state.matchingTabs[clickedIndex].title);
			}
		},


		focusTabByTitle: function(
			title)
		{
			var selectedTab = _.find(this.props.tabs, { title: title });

			if (selectedTab) {
				chrome.tabs.update(selectedTab.id, { active: true });

				if (selectedTab.windowId != chrome.windows.WINDOW_ID_CURRENT) {
					chrome.windows.update(selectedTab.windowId, { focused: true });
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
			selected)
		{
			var maxIndex = this.state.matchingTabs.length - 1;

			selected = Math.min(Math.max(0, selected), maxIndex);
			this.setState({ selected: selected });
		},


		render: function()
		{
			var selectedIndex = this.state.selected,
				tabItems = this.state.matchingTabs.slice(0, 10).map(function(tab, i) {
					return <TabItem
						key={i}
						title={tab.title}
						index={i}
						isSelected={i == selectedIndex}
					/>
				}),
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
					autoFocus={true}
					onChange={this.onQueryChange}
					onKeyDown={this.onKeyDown}
				/>
				<ul className="results-list"
					onClick={this.onClick}
					style={listStyle}
				>
					{tabItems}
				</ul>
			</div>
		}
	});


	return TabSelector;
});
