define([
	"jsx!./matched-string",
	"cp",
	"react",
	"lodash"
], function(
	MatchedString,
	cp,
	React,
	_
) {
	const MaxTitleLength = 70,
		MaxURLLength = 75;


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
			this.props.onItemClicked(this.props.item, event.shiftKey);
		},


		onMouseMove: function(
			event)
		{
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
				item = props.item,
				query = props.query,
				scores = item.scores,
				hitMasks = item.hitMasks,
				tooltip = [
					item.title.length > MaxTitleLength ? item.title : "",
					item.displayURL.length > MaxURLLength ? item.displayURL : ""
				].join("\n"),
				className = (props.selectedIndex == props.index) ? "selected" : "",
				style = {
					backgroundImage: "url(" + item.faviconURL + ")"
				};

			if (IsDevMode) {
				tooltip = _.toPairs(item.scores).map(a => a.join(": ")).join("\n") + tooltip;
			}

			return <li className={className}
				style={style}
				title={tooltip}
				onClick={this.onClick}
				onMouseMove={this.onMouseMove}
				onMouseEnter={this.onMouseEnter}
			>
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
			</li>
		}
	});


	return ResultsListItem;
});
