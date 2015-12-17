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
	var MinScore = .6,
		MaxItems = 10;


	var scoreArray = arrayScore(qsScore);


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
				// run scoreArray over all of the feature names to generate an
				// array with a { string: "..." } object wrapping each name.  passing
				// an empty query will cause scoreArray to a case-insensitive sort.
			this.sortableTabNames = scoreArray(_.pluck(this.props.tabs, "title"), "");

			return {
				matchingTitles: [],
				selected: null
			};
		},


		onQueryChange: function(
			event)
		{
			var scores = scoreArray(this.sortableTabNames, event.target.value),
					// don't show barely-matching results and limit it to 10
				matchingTitles = _.dropRightWhile(scores, function(item) {
					return item.score < MinScore;
				}).slice(0, MaxItems);

			this.setState({
				matchingTitles: matchingTitles,
				selected: null
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
					searchBox.value = "";
					searchBox.focus();
					this.onQueryChange({ target: { value: "" }});
					break;

				case 38:	// up arrow
					this.modifySelected(-1);
					event.preventDefault();
					break;

				case 40:	// down arrow
					this.modifySelected(1);
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
			}
		},


		modifySelected: function(
			delta)
		{
			var selected = this.state.selected,
				maxIndex = this.state.matchingTitles.length - 1;

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
			var maxIndex = this.state.matchingTitles.length - 1;

			selected = Math.min(Math.max(0, selected), maxIndex);
			this.setState({ selected: selected });
		},


		render: function()
		{
			var selectedIndex = this.state.selected,
				tabItems = this.state.matchingTitles.slice(0, 10).map(function(item, i) {
					return <TabItem
						key={i}
						title={item.string}
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
