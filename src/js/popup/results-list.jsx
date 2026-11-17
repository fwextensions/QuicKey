import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { IsFirefox, ResultsListRowHeight } from "@/background/constants";
import log from "@/background/persistent-log";


	// in FF, the scrollbar appears inside the right edge of the scrolling
	// area, instead on the outside.  so make the virtual list go right to
	// the edge of the popup, so the scrollbar doesn't cover the content.
const Width = IsFirefox ? 495 : 490;
const MinShownTime = 200;


	// return a stable identity for an item, so that a given row's DOM node is
	// reused only for the same item.  the key must not include the index,
	// since that would recycle a node when a different item lands on that row,
	// which is what we're trying to avoid.  prefix with the mode because a
	// bookmark ID and a tab ID can stringify to the same value, and the list
	// stays mounted when the mode changes.
function getItemKey(
	item,
	index,
	mode)
{
	const {id, sessionId} = item;

	if (sessionId !== undefined) {
			// closed tabs don't have a usable id, but sessionId is unique
		return `closed-${sessionId}`;
	} else if (id !== undefined) {
		return `${mode}-${id}`;
	} else {
			// message items have no ID, but they're the only item in the list
		return `${mode}-message-${index}`;
	}
}


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
		getItemKey: (index) => getItemKey(items[index], index, mode),
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
				// log any scroll this selection change asks for, since a row
				// that's already visible shouldn't move the list at all
			const from = virtualizer.scrollOffset;
			const [to] = virtualizer.getOffsetForIndex(selectedIndex) ?? [];

			if (to !== undefined && to !== from) {
				log("results list scrollToIndex",
					"index:", selectedIndex,
					"from:", from,
					"to:", to,
					"size:", virtualizer.getSize(),
					"clientHeight:", scrollElementRef.current?.clientHeight,
					"height:", height,
					"dpr:", devicePixelRatio);
			}

			virtualizer.scrollToIndex(selectedIndex);
		}
	}, [selectedIndex, itemCount]);


		// the list's rows are 45px, and keyboard navigation scrolls by whole
		// rows, so an offset a px or two off a row boundary is the shift we're
		// chasing.  log those, but not every offset a wheel scroll passes through.
	useEffect(() => {
		const element = scrollElementRef.current;

		if (!element) {
			return;
		}

		const handleScroll = () => {
			const {scrollTop} = element;
			const remainder = scrollTop % ResultsListRowHeight;
			const offGrid = Math.min(remainder, ResultsListRowHeight - remainder);

			if (offGrid > 0 && offGrid <= 3) {
				log("results list off-grid scroll",
					"scrollTop:", scrollTop,
					"clientHeight:", element.clientHeight,
					"size:", virtualizer.getSize(),
					"dpr:", devicePixelRatio);
			}
		};

		element.addEventListener("scroll", handleScroll);

		return () => element.removeEventListener("scroll", handleScroll);
	}, []);


		// after each render, record where the list sits in the window, so a
		// shift caused by something above it changing height shows up too.
		// deduped, since this runs on every keystroke and arrow press.
	const lastLayout = useRef("");

	useEffect(() => {
		const element = scrollElementRef.current;

		if (!element || !visible) {
			return;
		}

		const frame = requestAnimationFrame(() => {
			const {top} = element.getBoundingClientRect();
				// use only the part of scrollTop that's off a row boundary, so
				// scrolling a row at a time with the arrow keys doesn't log
			const layout = [top, element.scrollTop % ResultsListRowHeight,
				element.clientHeight, height, devicePixelRatio].join();

			if (layout !== lastLayout.current) {
				lastLayout.current = layout;
				log("results list layout",
					"top:", top,
					"scrollTop:", element.scrollTop,
					"clientHeight:", element.clientHeight,
					"height:", height,
					"dpr:", devicePixelRatio,
					"selected:", selectedIndex);
			}
		});

		return () => cancelAnimationFrame(frame);
	});


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
