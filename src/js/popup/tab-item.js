define([
	"react",
	"lodash"
], function(
	React,
	_
) {
	const FaviconURL = "chrome://favicon/";


		// memoize this, since it could get called multiple times by render() with
		// the same values, such as when the selection changes but the query doesn't
	var wrapMatches = _.memoize(function(
		query,
		string,
		hitMask)
	{
		if (!query) {
			return string;
		}

			// start with -1 so that the first while loop below starts searching
			// at 0
		var index = -1,
			indices = [],
			strings;

			// the hit mask contains a true wherever there was a match in the string
		while ((index = hitMask.indexOf(true, index + 1)) > -1) {
			indices.push(index);
		}

		strings = indices.map(function(index, i) {
				// escape the part before the bold char, so that any brackets
				// in the title or URL don't get interpreted
			var prefix = _.escape(string.slice((indices[i - 1] + 1) || 0, index)),
				boldChar = string[index] && "<b>" + string[index] + "</b>";

				// use an empty string if didn't find the boldChar, so we
				// don't append "undefined"
			return prefix + (boldChar || "");
		});

			// add the part of the string after the last char match.  if the
			// hit mask is empty, slice(NaN) will return the whole string.
		strings.push(_.escape(string.slice(_.last(indices) + 1)));

		return strings.join("");
	}, function(query, string) {
			// by default, memoize uses just the first arg as a key, but that's the
			// same for all titles/urls.  so combine them to generate something unique.
		return query + string;
	});


	var TabItem = React.createClass({
		ignoreMouse: true,


		onClick: function(
			event)
		{
			this.props.focusTab(this.props.tab);
		},


		onMouseMove: function(
			event)
		{
			if (this.ignoreMouse) {
					// tell the list that the mouse is moving, so it no longer
					// ignores setting the selection from onMouseEnter
				this.props.onMouseMove(event);
				this.ignoreMouse = false;
			} else if (!this.props.isSelected) {
					// the mouse is moving over this item but it's not
					// selected, which means this is the second mousemove
					// event while mouseenter is still being ignored.  so
					// force this item to be selected.
				this.props.setSelectedIndex(this.props.index);
			}
		},


		onMouseEnter: function(
			event)
		{
			if (!this.ignoreMouse) {
					// pass true to let the list know this was from a mouse event
				this.props.setSelectedIndex(this.props.index, true);
			}
		},


		render: function()
		{
			var props = this.props,
				tab = props.tab,
				query = props.query,
				hitMasks = tab.hitMasks,
				title = wrapMatches(query, tab.title, hitMasks.title),
				url = wrapMatches(query, tab.displayURL, hitMasks.displayURL),
				className = props.isSelected ? "selected" : "",
					// look up the favicon via chrome://favicon if the tab itself
					// doesn't have one.  we want to prioritize the tab's URL
					// since The Great Suspender creates faded favicons and stores
					// them as data URIs in tab.favIconUrl.
				faviconURL = tab.favIconUrl || FaviconURL + (tab.unsuspendURL || tab.url),
				style = {
					backgroundImage: "url(" + faviconURL + ")"
				};

				// the inner HTML below will be escaped by wrapMatches()
// 				title={this.props.tab.score}
			return <li className={className}
				style={style}
				onClick={this.onClick}
				onMouseMove={this.onMouseMove}
				onMouseEnter={this.onMouseEnter}
			>
				<div className="title" dangerouslySetInnerHTML={{ __html: title }} />
				<div className="url" dangerouslySetInnerHTML={{ __html: url }} />
			</li>
		}
	});


	return TabItem;
});
