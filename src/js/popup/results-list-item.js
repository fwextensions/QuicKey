define([
	"jsx!./matched-string",
	"cp",
	"lib/copy-to-clipboard",
	"react",
	"lodash"
], function(
	MatchedString,
	cp,
	copyTextToClipboard,
	React,
	_
) {
	const MaxTitleLength = 70,
		MaxURLLength = 75,
		SuspendedFaviconOpacity = .5,
		FaviconURL = "chrome://favicon/";

	var IsDevMode = false;


	cp.management.getSelf()
		.then(function(info) {
			IsDevMode = info.installType == "development";
		});


	var ResultsListItem = React.createClass({
		ignoreMouse: true,


		onClick: function(
			event)
		{
			var item = this.props.item;

			if (IsDevMode && event.altKey) {
					// copy some debug info to the clipboard
				copyTextToClipboard([
					item.title,
					item.displayURL,
					this.props.query,
					item.recentBoost,
					_.toPairs(item.scores).map(function(a) { return a.join(": "); }).join("\n")
				].join("\n"));
			} else {
				this.props.onItemClicked(item, event.shiftKey);
			}
		},


		onMouseMove: function(
			event)
		{
			var props = this.props;

			if (this.ignoreMouse) {
					// we'll swallow this first mousemove, since it's probably
					// from the item being rendered under the mouse, but we'll
					// respond to the next one
				this.ignoreMouse = false;
			} else if (!this.props.isSelected) {
					// the mouse is moving over this item but it's not
					// selected, which means this is the second mousemove
					// event and we haven't gotten another mouseenter.  so
					// force this item to be selected.
				props.setSelectedIndex(props.index);
			}
		},


		onMouseEnter: function(
			event)
		{
			if (!this.ignoreMouse) {
				this.props.setSelectedIndex(this.props.index);
			}
		},


		render: function()
		{
			var props = this.props,
				item = props.item,
				query = props.query,
				scores = item.scores,
				hitMasks = item.hitMasks,
				tooltip = [
					item.title.length > MaxTitleLength ? item.title : "",
					item.displayURL.length > MaxURLLength ? item.displayURL : ""
				].join("\n"),
				className = [
					"results-list-item",
					(props.isSelected ? "selected" : ""),
					(item.unsuspendURL ? "suspended" : ""),
					(item.incognito ? "incognito" : ""),
					(item.sessionId ? "closed suspended" : "")
				].join(" "),
				faviconStyle = {
					backgroundImage: "url(" + item.faviconURL + ")"
				};

			if (IsDevMode) {
				tooltip = _.toPairs(item.scores).concat([["recentBoost", item.recentBoost], ["id", item.id]])
					.map(function(a) { return a.join(": "); }).join("\n") + "\n" + tooltip;
			}

				// blank lines at the end of the tooltip show up in macOS Chrome,
				// so trim them
			tooltip = tooltip.trim();

			if ((item.unsuspendURL && item.faviconURL.indexOf(FaviconURL) == 0)
					|| item.sessionId) {
					// this is a suspended tab, but The Great Suspender has
					// forgotten the faded favicon for it or has set its own
					// icon for some reason.  so we get the favicon through
					// chrome://favicon/ and then fade it ourselves.  or it's a
					// tab from a closed session.
				faviconStyle.opacity = SuspendedFaviconOpacity;
			}

			return <div className={className}
				style={props.style}
				title={tooltip}
				onClick={this.onClick}
				onMouseMove={this.onMouseMove}
				onMouseEnter={this.onMouseEnter}
			>
				<span className="favicon"
					style={faviconStyle}
				/>
				<MatchedString className="title"
					query={query}
					text={item.title}
					score={scores.title}
					hitMask={hitMasks.title}
				/>
				<MatchedString className="url"
					query={query}
					text={item.displayURL}
					score={scores.displayURL}
					hitMask={hitMasks.displayURL}
				/>
			</div>
		}
	});


	return ResultsListItem;
});
