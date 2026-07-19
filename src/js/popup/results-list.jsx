import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { IsFirefox, ResultsListRowHeight } from "@/background/constants";


	// in FF, the scrollbar appears inside the right edge of the scrolling
	// area, instead on the outside.  so make the virtual list go right to
	// the edge of the popup, so the scrollbar doesn't cover the content.
const Width = IsFirefox ? 495 : 490;
const MinShownTime = 200;


export default forwardRef(function ResultsList(
	{
		items,
		maxItems,
		itemComponent,
		query,
		mode,
		visible,
		selectedIndex,
		setSelectedIndex,
		openItem,
		closeTab
	},
	ref)
{
	const itemCount = items.length;
	const height = Math.min(itemCount, maxItems) * ResultsListRowHeight;
	const scrollElementRef = useRef(null);
	const hoverSelectEnabled = useRef(false);
	const renderTimer = useRef(null);
	const virtualizer = useVirtualizer({
		count: itemCount,
		getScrollElement: () => scrollElementRef.current,
		estimateSize: () => ResultsListRowHeight,
	});


	const disableHoverSelect = () =>
	{
		clearTimeout(renderTimer.current);
		hoverSelectEnabled.current = false;
		renderTimer.current = null;
	};


	const handleItemHovered = (
		index) =>
	{
		if (hoverSelectEnabled.current && index !== selectedIndex) {
				// pass true so the app treats a mouse selection like one
				// made by the MRU key, so that the user can press the menu
				// shortcut, highlight a tab with the mouse, and then
				// release alt to select it
			setSelectedIndex(index, true);
		}
	};


		// enable hover-select a beat after the items change or the popup is
		// shown, so that the selection doesn't jump to whatever happens to be
		// under the mouse as the list renders
	useEffect(() => {
		disableHoverSelect();

		if (visible) {
			renderTimer.current = setTimeout(() => {
				hoverSelectEnabled.current = true;
				renderTimer.current = null;
			}, MinShownTime);
		}

		return disableHoverSelect;
	}, [items, visible]);


		// keep the selected row scrolled into view, which react-virtualized
		// used to handle via its scrollToIndex prop
	useEffect(() => {
		if (selectedIndex >= 0 && selectedIndex < itemCount) {
			virtualizer.scrollToIndex(selectedIndex);
		}
	}, [selectedIndex, itemCount]);


	useImperativeHandle(ref, () => ({
		scrollToRow(
			index)
		{
			virtualizer.scrollToIndex(index);
		},

		scrollByPage(
			direction)
		{
				// range tracks the currently visible rows, so we know how to
				// change the selection when the app tells us to page up/down
			const { startIndex = 0, endIndex = 0 } = virtualizer.range ?? {};
			const rowCount = Math.min(maxItems, itemCount) - 1;
			let newIndex = selectedIndex;

			if (direction == "down") {
				if (selectedIndex == endIndex) {
					newIndex = Math.min(selectedIndex + rowCount, itemCount - 1);
				} else {
					newIndex = endIndex;
				}
			} else {
				if (selectedIndex == startIndex) {
					newIndex = Math.max(selectedIndex - rowCount, 0);
				} else {
					newIndex = startIndex;
				}
			}

			setSelectedIndex(newIndex);
		}
	}));


	return <div className="results-list-container"
		style={{ display: height ? "block" : "none" }}
	>
		<div className="results-list"
			ref={scrollElementRef}
			tabIndex={-1}
			style={{
				width: Width,
				height,
				position: "relative",
				overflowY: "auto",
				overflowX: "hidden",
				willChange: "transform"
			}}
		>
			<div style={{
				height: virtualizer.getTotalSize(),
				width: "100%",
				position: "relative"
			}}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const item = items[virtualItem.index];
					const ItemComponent = item.component || itemComponent;

					return <ItemComponent
						key={virtualItem.key}
						item={item}
						index={virtualItem.index}
						query={query}
						mode={mode}
						isSelected={selectedIndex == virtualItem.index}
						openItem={openItem}
						closeTab={closeTab}
						onHover={handleItemHovered}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: virtualItem.size,
							transform: `translateY(${virtualItem.start}px)`
						}}
					/>
				})}
			</div>
		</div>
	</div>
});
