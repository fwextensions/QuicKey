define([
	"react",
	"react-virtualized"
], function(
	React,
	ReactVirtualized
) {
	const RowHeight = 45,
		MaxRows = 10,
		Width = 490;


	var ResultsList = React.createClass({
		rowRenderer: function(
			data)
		{
			var props = this.props,
				item = props.items[data.index];

			return <props.ItemComponent
				key={data.key}
				item={item}
				index={data.index}
				isSelected={props.selectedIndex == data.index}
				style={data.style}
				{...props}
			/>
		},


		render: function()
		{
			var props = this.props,
				itemCount = props.items.length,
				height = Math.min(itemCount, MaxRows) * RowHeight,
				style = {
					display: height ? "block" : "none"
				};

			return <div className="results-list-container"
				style={style}
			>
				<ReactVirtualized.List
					className="results-list"
					width={Width}
					height={height}
					rowCount={itemCount}
					rowHeight={RowHeight}
					rowRenderer={this.rowRenderer}
					scrollToIndex={props.selectedIndex}
					{...props}
				/>
			</div>
		}
	});


	return ResultsList;
});
