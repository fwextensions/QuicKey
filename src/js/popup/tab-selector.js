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
		MaxItems = 10,
		SuspendedURLPattern = /^chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#uri=(.+)$/,
		ProtocolPattern = /(chrome-extension:\/\/klbibkeccnjlkjkiokjodocebajanakg\/suspended\.html#uri=)?(https?|file):\/\//,
		DefaultFaviconURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAbElEQVQ4T2NkoBAwIuuPiopqwGbev3//DqxYseIANjkMA5YtW4ZiCMjQ////f/j///8FbIYQZcC3b98mcHJyJmAzhCgDQK4KCAgQwGYIUQag+x3ZmwQNQNcMCpNRA4Z/GBCTOXGmA2I0o6sBAMYQhBFUQQkzAAAAAElFTkSuQmCC";


		// use title and url as the two keys to score
	var scoreArray = arrayScore(qsScore, ["title", "url"]);


		// memoize this, since it could get called multiple times by render() with
		// the same values, such as when the selection changes but the query doesn't
	var wrapMatches = _.memoize(function(
		query,
		string)
	{
		if (!query) {
			return string;
		}

		var lcQuery = query.toLowerCase(),
			lcString = string.toLowerCase(),
			indices = lcQuery.split("").reduce(function(offsets, char, i) {
					// for the first char, the undefined + 1 will be ignored by
					// indexOf, so it'll start looking from the first char
				var index = lcString.indexOf(char, _.last(offsets) + 1);

					// only store found chars as long as we found the first one
					// in the query.  this means that if the first char is found,
					// we'll keep adding subsequent ones that are found, even if
					// intervening ones are not.
				if (index > -1 && (offsets.length || i == 0)) {
					offsets.push(index);
				}

				return offsets;
			}, []),
			strings = indices.map(function(index, i) {
					// escape the part before the bold char, so that any brackets
					// in the title or URL don't get interpreted
				var prefix = _.escape(string.slice(indices[i - 1] + 1, index)),
					boldChar = string[index] && "<b>" + string[index] + "</b>";

					// use an empty string if didn't find the boldChar, so we
					// don't append "undefined"
				return prefix + (boldChar || "");
			});

			// add the part of the string after the last char match.  if we didn't
			// match anything, meaning that indices is empty, slice(NaN) will
			// return the whole string.
		strings.push(_.escape(string.slice(_.last(indices) + 1)));

		return strings.join("");
	}, function(query, string) {
			// by default, memoize uses just the first arg as a key, but that's the
			// same for all titles/urls.  so combine them to generate something unique.
		return query + string;
	});


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
			var title = wrapMatches(this.props.query, this.props.tab.title),
				url = wrapMatches(this.props.query, this.props.tab.displayURL),
				className = this.props.isSelected ? "selected" : "",
					// tabs without a favicon will have an undefined favIconUrl
				faviconURL = this.props.tab.favIconUrl || DefaultFaviconURL,
				style = {
					backgroundImage: "url(" + faviconURL + ")"
				};

				// the inner HTML below will be escaped by wrapMatches()
			return <li className={className}
				style={style}
				title={this.props.tab.score}
				onClick={this.onClick}
				onMouseEnter={this.onMouseEnter}
			>
				<div className="title" dangerouslySetInnerHTML={{ __html: title }} />
				<div className="url" dangerouslySetInnerHTML={{ __html: url }} />
			</li>
		}
	});


	var TabSelector = React.createClass({
		getInitialState: function()
		{
			var query = this.props.initialQuery;

				// add a displayURL to each tab so that we can score against it
				// in onQueryChange
			this.props.tabs.forEach(function(tab) {
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
			selected)
		{
			var maxIndex = this.state.matchingTabs.length - 1;

			selected = Math.min(Math.max(0, selected), maxIndex);
			this.setState({ selected: selected });
		},


		render: function()
		{
			var selectedIndex = this.state.selected,
				query = this.state.query,
				tabItems = this.state.matchingTabs.map(function(tab, i) {
					return <TabItem
						key={i}
						tab={tab}
						index={i}
						isSelected={i == selectedIndex}
						query={query}
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
