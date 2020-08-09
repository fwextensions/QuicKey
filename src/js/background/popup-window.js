define([
	"cp",
	"shared",
	"background/quickey-storage",
	"background/constants"
], (
	cp,
	shared,
	storage,
	{IsMac}
) => {
	const PopupInnerWidth = 500;
	const PopupInnerHeight = 488;
	const OffscreenX = 13000;
	const OffscreenY = 13000;
	const PopupPadding = 50;


	let popupAdjustmentWidth = 0;
	let popupAdjustmentHeight = 0;
	let isVisible = false;
	let type = "window";
	let windowID;
	let tabID;
	let lastActiveTab;


	storage.get(data => ({popupAdjustmentWidth, popupAdjustmentHeight} = data));


	async function getLastWindow()
	{
		const windows = await cp.windows.getAll({
			windowTypes: ["normal"],
			populate: true
		});

			// return the last unfocused window, or just the last one, if
			// there's only one open and it's focused
		return windows.filter(({focused, incognito}) => !focused && !incognito).pop()
			|| windows.pop();
	}


	function getScreen()
	{
		return {
			left: screen.availLeft || 0,
			top: screen.availTop || 0,
			width: screen.availWidth,
			height: screen.availHeight
		};
	}


	function getAlignedPosition(
		alignment,
		size,
		start,
		availableSpace,
		padding)
	{
		switch (alignment) {
			case "left":
			case "top":
				return start + padding;

			case "center":
				return start + Math.floor((availableSpace - size) / 2);

			case "right":
			case "bottom":
				return start + availableSpace - padding - size;
		}
	}


	function calcPosition(
		targetWindow,
		alignment = "center-center")
	{
		const {left: targetX, top: targetY, width: targetW, height: targetH} =
			targetWindow || getScreen();
		const width = PopupInnerWidth + popupAdjustmentWidth;
		const height = PopupInnerHeight + popupAdjustmentHeight;
		const [horizontal, vertical] = alignment.split("-");
		const left = getAlignedPosition(horizontal, width, targetX, targetW, PopupPadding);
		const top = getAlignedPosition(vertical, height, targetY, targetH, PopupPadding);

		return { left, top, width, height };
	}


	async function create(
		activeTab,
		focusSearch,
		alignment)
	{
			// close any existing window, in case one was still open
		await close();

			// get the full URL with the extension ID in it so that we can
			// delete it from the history below, which requres an exact match
		const url = chrome.runtime.getURL(`popup.html?${new URLSearchParams({ type, focusSearch })}`);
		const targetWindow = await cp.windows.get(activeTab.windowId);
		let {left, top, width, height} = calcPosition(targetWindow, alignment);
		let window;

		if (type == "window") {
			window = await cp.windows.create({
				url,
				type: "popup",
				focused: true,
				setSelfAsOpener: true,
				left,
				top,
				width,
				height
			});
			windowID = window.id;
		} else {
				// first add the tab to the last unfocused window, then move
				// that tab to a new popup window
			const lastWindow = await getLastWindow();
			const tab = await cp.tabs.create({
				url,
				active: false,
				windowId: lastWindow.id,
				index: lastWindow.tabs.length + 1
			});

			tabID = tab.id;
			window = await show(activeTab);
		}

		const [popupTab] = window.tabs;
		const {width: innerWidth, height: innerHeight} = popupTab;
		const widthDelta = PopupInnerWidth - innerWidth;
		const heightDelta = PopupInnerHeight - innerHeight;

		if (widthDelta || heightDelta) {
				// the current adjustments weren't enough to hit the target size,
				// so update them with the latest deltas, and then adjust the
				// popup size
			popupAdjustmentWidth += widthDelta;
			popupAdjustmentHeight += heightDelta;
			width += widthDelta;
			height += heightDelta;

				// shift the position by half a negative delta to keep the
				// window centered in the target area
			left += -Math.floor(widthDelta / 2);
			top += -Math.floor(heightDelta / 2);

			await cp.windows.update(window.id, { left, top, width, height });
			await storage.set(() => ({ popupAdjustmentWidth, popupAdjustmentHeight }));
		}

		lastActiveTab = activeTab;
		isVisible = true;

			// after opening the popup, we want to remove its entry from the
			// history, since it's not a real webpage.  doing this in a timeout
			// is kludgy, but the history doesn't seem to have been updated by
			// this point, so wait a second and then delete it.
		setTimeout(() => cp.history.deleteUrl({ url }), 1000);

		return window;
	}


	async function show(
		activeTab,
		alignment)
	{
		const targetWindow = activeTab && await cp.windows.get(activeTab.windowId);
		let {left, top, width, height} = calcPosition(targetWindow, alignment);
		let result = Promise.resolve();

			// if we're already visible and show() is being called again, that
			// means the user is navigating recent tabs while keeping the popup
			// open, so focus the existing window even if it's in tab mode
		if (isVisible || (type == "window" && windowID)) {
			result = cp.windows.update(windowID, { focused: true, left, top });
		} else if (type == "tab" && tabID) {
				// create a popup window with the tab that's hiding in another
				// window, instead of passing in a URL
			const window = await cp.windows.create({
				type: "popup",
				tabId: tabID,
				focused: true,
				setSelfAsOpener: true,
				left,
				top,
				width,
				height
			});

			windowID = window.id;

			result = Promise.resolve(window);
		}

		lastActiveTab = activeTab;
		isVisible = true;

		return result.catch(console.error);
	}


	async function hide(
		unfocus,
		targetTabOrWindow)
	{
		let options = {
			left: OffscreenX,
			top: OffscreenY
		};

		if (targetTabOrWindow && (IsMac || devicePixelRatio !== 1)) {
				// hide the popup behind the focused window
			const {left, top} = calcPosition(
				targetTabOrWindow.windowId
					? await cp.windows.get(targetTabOrWindow.windowId)
					: targetTabOrWindow
			);

			options = { left, top };
		}

		if (unfocus) {
			options.focused = false;
		}

		isVisible = false;

		if (type == "window" && windowID) {
			try {
				await cp.windows.update(windowID, options);
			} catch (e) {
					// we couldn't move the window for some reason, so close it
				await close();
			}
		} else if (type == "tab" && tabID) {
			const lastWindow = await getLastWindow();

			if (lastWindow) {
				try {
					if (!IsMac) {
							// move the popup behind the target window before
							// moving the tab to a window, so you don't see the
							// popup get painted black as it's closing in Win10.
							// on macOS, this doesn't happen, and the process of
							// centering the popup on the window is visible.
						await cp.windows.update(windowID, options);
					}

					await cp.tabs.move(tabID, {
						windowId: lastWindow.id,
						index: -1
					});
				} catch (e) {
					// ignore this error, as it's most likely due to the user
					// switching to the hidden tab and then away, causing it to
					// lose focus, which then calls hide(), but the popup window
					// in which the tab was previously shown is already closed
				}
			} else {
					// there's no window in which to stash the tab, so just
					// close it
				await close();
			}
		}
	}


	async function blur()
	{
		await cp.windows.update(windowID, { focused: false });
	}


	async function close()
	{
		if (tabID) {
			try {
				await cp.tabs.remove(tabID);
			} catch (e) {}
		}

		if (windowID) {
			try {
				await cp.windows.remove(windowID);
			} catch (e) {}
		}

		windowID = 0;
		tabID = 0;
		isVisible = false;
	}


	return shared("popupWindow", () => ({
		create,
		show,
		hide,
		blur,
		close,
		get type() {
			return type;
		},
		set type(value) {
			if (type !== value) {
				close();
			}

			type = value;
		},
		get id() {
			return windowID;
		},
		get isOpen() {
			const query = type == "window"
				? { windowId: windowID }
				: { tabId: tabID };

			return chrome.extension.getViews(query).length > 0;
		},
		get isVisible() {
			return isVisible;
		},
		get activeTab() {
			return lastActiveTab;
		}
	}));
});
