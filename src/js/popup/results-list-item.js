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
	const MaxTitleLength = 70;
	const MaxURLLength = 75;
	const MinMouseMoveCount = 1;
	const SuspendedFaviconOpacity = .5;
	const FaviconURL = "chrome://favicon/";

	let IsDevMode = false;


	cp.management.getSelf()
		.then(function(info) {
			IsDevMode = info.installType == "development";
		});


	const ResultsListItem = React.createClass({
		mouseMoveCount: 0,


		onClick: function(
			event)
		{
			const {item} = this.props;

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


		onClose: function(
			event)
		{
				// stop the click from bubbling so the tab doesn't get focused
				// just before it's closed
			event.stopPropagation();
			this.props.onTabClosed(this.props.item);
		},


		onMouseMove: function(
			event)
		{
			const {props} = this;

			if ((props.selectedIndex > 0 || this.mouseMoveCount > MinMouseMoveCount)
					&& !props.isSelected) {
					// the mouse is moving over this item but it's not
					// selected, which means this is the third mousemove
					// event and we haven't gotten another mouseenter.  so
					// force this item to be selected.  also select it when an
					// item beyond the first one is selected, which means this
					// mousemove isn't happening right after the menu was rendered
					// under the mouse, since the selection has already changed.
				props.setSelectedIndex(props.index);
			} else {
					// we want to swallow the first two mousemove events because
					// the item that's rendered under the mouse when the popup
					// first opens gets at least one mousemove.  on a high-DPI
					// screen, it sometimes gets a second one, which was causing
					// the menu item to be accidentally selected.
				this.mouseMoveCount++;
			}
		},


		onMouseEnter: function(
			event)
		{
			const {props} = this;

			if (props.selectedIndex > 0 || this.mouseMoveCount > MinMouseMoveCount) {
				props.setSelectedIndex(props.index);
			}
		},


		render: function()
		{
			const {props} = this;
			const {item, query} = props;
			const {scores, hitMasks, title, displayURL, titleIndex} = item;
			const className = [
				"results-list-item",
				props.mode,
				(props.isSelected ? "selected" : ""),
				(item.unsuspendURL ? "suspended" : ""),
				(item.incognito ? "incognito" : ""),
				(item.sessionId ? "closed" : "")
			].join(" ");
			const faviconStyle = {
				backgroundImage: "url(" + item.faviconURL + ")"
			};
			let tooltip = [
				title.length > MaxTitleLength ? title : "",
				displayURL.length > MaxURLLength ? displayURL : ""
			].join("\n");

			if (IsDevMode) {
				tooltip = _.toPairs(item.scores).concat([["recentBoost", item.recentBoost], ["id", item.id]])
					.map(function(a) { return a.join(": "); }).join("\n") + "\n" + tooltip;
			}

				// blank lines at the end of the tooltip show up in macOS Chrome,
				// so trim them
			tooltip = tooltip.trim();

			if (item.unsuspendURL && item.faviconURL.indexOf(FaviconURL) == 0 &&
					!item.sessionId) {
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
				<div className="title">
					{titleIndex &&
						<div className="title-index"
							title="Position among tabs with the same title"
						>{titleIndex}</div>}
					<MatchedString
						query={query}
						text={title}
						score={scores.title}
						hitMask={hitMasks.title}
					/>
				</div>
				<div className="url">
					<MatchedString
						query={query}
						text={displayURL}
						score={scores.displayURL}
						hitMask={hitMasks.displayURL}
					/>
				</div>
				<button className="close-button"
					title="Close tab"
					onClick={this.onClose}
				/>
			</div>
		}
	});


	return ResultsListItem;
});
