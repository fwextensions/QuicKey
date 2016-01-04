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
	var MinScore = .4,
		MaxItems = 10,
		ProtocolPattern = /(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#uri=)?https?:\/\//,
		DefaultFaviconURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAbElEQVQ4T2NkoBAwIuuPiopqwGbev3//DqxYseIANjkMA5YtW4ZiCMjQ////f/j///8FbIYQZcC3b98mcHJyJmAzhCgDQK4KCAgQwGYIUQag+x3ZmwQNQNcMCpNRA4Z/GBCTOXGmA2I0o6sBAMYQhBFUQQkzAAAAAElFTkSuQmCC";


		// use title and url as the two keys to score
	var scoreArray = arrayScore(qsScore, ["title", "url"]);


	var TabItem = React.createClass({
		onClick: function(
			event)
		{
			this.props.focusTab(this.props.tab);
		},


		onMouseEnter: function(
			event)
		{
			this.props.setSelectedIndex(this.props.index);
		},


		render: function()
		{
			var title = this.props.tab.title,
				url = this.props.tab.displayURL,
				className = this.props.isSelected ? "selected" : "",
					// tabs without a favicon will have an undefined favIconUrl
				faviconURL = this.props.tab.favIconUrl || DefaultFaviconURL,
				style = {
					backgroundImage: "url(" + faviconURL + ")"
				};

			return <li className={className}
				style={style}
				onClick={this.onClick}
				onMouseEnter={this.onMouseEnter}
			>
				<div className="title">{title}</div>
				<div className="url">{url}</div>
			</li>
		}
	});


	var TabSelector = React.createClass({
		getInitialState: function()
		{
				// add a displayURL to each tab so that we can score against it
				// in onQueryChange
			this.props.tabs.forEach(function(tab) {
				tab.displayURL = tab.url.replace(ProtocolPattern, "");
			});

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
					this.focusTab(this.state.matchingTabs[this.state.selected]);
					event.preventDefault();
					break;
			}
		},


		focusTab: function(
			tab)
		{
			if (tab) {
				chrome.tabs.update(tab.id, { active: true });

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
						tab={tab}
						index={i}
						isSelected={i == selectedIndex}
						focusTab={this.focusTab}
						setSelectedIndex={this.setSelectedIndex}
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
