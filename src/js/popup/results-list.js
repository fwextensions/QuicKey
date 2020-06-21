define([
	"react",
	"react-virtualized",
	"lib/handle-ref"
], function(
	React,
	ReactVirtualized,
	handleRef
) {
	const RowHeight = 45;
	const Width = 490;


	const ResultsList = React.createClass({
		startIndex: 0,
		stopIndex: 0,
		list: null,


		scrollByPage: function(
			direction)
		{
			const {items: {length: itemCount}, maxItems, setSelectedIndex} = this.props;
			const rowCount = Math.min(maxItems, itemCount) - 1;
			let {selectedIndex} = this.props;

			if (direction == "down") {
				if (selectedIndex == this.stopIndex) {
					selectedIndex = Math.min(selectedIndex + rowCount, itemCount - 1);
				} else {
					selectedIndex = this.stopIndex;
				}
			} else {
				if (selectedIndex == this.startIndex) {
					selectedIndex = Math.max(selectedIndex - rowCount, 0);
				} else {
					selectedIndex = this.startIndex;
				}
			}

			setSelectedIndex(selectedIndex);
		},


		scrollToRow: function(
			index)
		{
			this.list.scrollToRow(index);
		},


		handleListRef: handleRef("list"),


		onRowsRendered: function(
			event)
		{
				// track the visible rendered rows so we know how to change the
				// selection when the App tells us to page up/down, since it
				// doesn't know what's visible
			this.startIndex = event.startIndex;
			this.stopIndex = event.stopIndex;
		},


		rowRenderer: function(
			data)
		{
			const {props} = this;
			const {itemComponent, selectedIndex} = props;
			const item = props.items[data.index];
			const ItemComponent = item.component || itemComponent;

			return <ItemComponent
				key={data.key}
				item={item}
				index={data.index}
				isSelected={selectedIndex == data.index}
				style={data.style}
				{...props}
			/>
		},


		render: function()
		{
			const {props} = this;
			const {items: {length: itemCount}, maxItems, selectedIndex} = props;
			const height = Math.min(itemCount, maxItems) * RowHeight;
			const style = { display: height ? "block" : "none" };

			return <div className="results-list-container"
				style={style}
			>
				<ReactVirtualized.List
					ref={this.handleListRef}
					className="results-list"
					tabIndex={-1}
					width={Width}
					height={height}
					rowCount={itemCount}
					rowHeight={RowHeight}
					rowRenderer={this.rowRenderer}
					scrollToIndex={selectedIndex}
					onRowsRendered={this.onRowsRendered}
					{...props}
				/>
			</div>
		}
	});


	return ResultsList;
});
