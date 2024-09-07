import React from "react";
import {List} from "react-virtualized/dist/es/List";
import handleRef from "@/lib/handle-ref";
import {IsFirefox, ResultsListRowHeight} from "@/background/constants";


	// in FF, the scrollbar appears inside the right edge of the scrolling
	// area, instead on the outside.  so make the virtual list go right to
	// the edge of the popup, so the scrollbar doesn't cover the content.
const Width = IsFirefox ? 495 : 490;
const MinShownTime = 200;


export default class ResultsList extends React.Component {
    startIndex = 0;
    stopIndex = 0;
    list = null;
	renderTimer = null;
	hoverSelectEnabled = false;


	componentDidUpdate(
		prevProps)
	{
		const itemsChanged = prevProps.items !== this.props.items;

		if (itemsChanged) {
				// the virtual list doesn't know when the items have changed,
				// so force it to update when they do
			this.list.forceUpdateGrid();
		}

		if (itemsChanged || (!prevProps.visible && this.props.visible)) {
			this.enableHoverSelectDelayed();
		} else if (prevProps.visible && !this.props.visible) {
				// make sure the timer is cleared when the popup is hidden
			this.disableHoverSelect();
		}
	}


	scrollByPage(
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
	}


	scrollToRow(
		index)
	{
		this.list.scrollToRow(index);
	}


	enableHoverSelectDelayed()
	{
		this.disableHoverSelect();
		this.renderTimer = setTimeout(this.handleRenderTimerDone, MinShownTime);
	}


	disableHoverSelect()
	{
		clearTimeout(this.renderTimer);
		this.hoverSelectEnabled = false;
		this.renderTimer = null;
	}


	handleRenderTimerDone = () =>
	{
		this.hoverSelectEnabled = true;
		this.renderTimer = null;
	}


	handleItemHovered = (
		index) =>
	{
		if (this.hoverSelectEnabled && index !== this.props.selectedIndex) {
				// pass true so the app treats a mouse selection like one
				// made by the MRU key, so that the user can press the menu
				// shortcut, highlight a tab with the mouse, and then
				// release alt to select it
			this.props.setSelectedIndex(index, true);
		}
	};


	handleListRef = handleRef("list", this);


    handleRowsRendered = (
		event) =>
	{
			// track the visible rendered rows so we know how to change the
			// selection when the App tells us to page up/down, since it
			// doesn't know what's visible
		this.startIndex = event.startIndex;
		this.stopIndex = event.stopIndex;
	};


    rowRenderer = (
		data) =>
	{
		const {
			itemComponent,
			items,
			query,
			mode,
			selectedIndex,
			openItem,
			closeTab
		} = this.props;
		const item = items[data.index];
		const ItemComponent = item.component || itemComponent;

		return <ItemComponent
			key={data.key}
			item={item}
			index={data.index}
			query={query}
			mode={mode}
			isSelected={selectedIndex == data.index}
			openItem={openItem}
			closeTab={closeTab}
			onHover={this.handleItemHovered}
			style={data.style}
		/>
	};


    render()
	{
		const {items: {length: itemCount}, maxItems, selectedIndex} = this.props;
		const height = Math.min(itemCount, maxItems) * ResultsListRowHeight;
		const style = { display: height ? "block" : "none" };

		return <div className="results-list-container"
			style={style}
		>
			<List
				ref={this.handleListRef}
				className="results-list"
				tabIndex={-1}
				width={Width}
				height={height}
				rowCount={itemCount}
				rowHeight={ResultsListRowHeight}
				rowRenderer={this.rowRenderer}
				scrollToIndex={selectedIndex}
				onRowsRendered={this.handleRowsRendered}
			/>
		</div>
	}
}
