define([
	"cp",
	"shared"
], (
	cp,
	shared
) => {
	const PopupInnerWidth = 500;
	const PopupInnerHeight = 488;
	const OffscreenX = 13000;
	const OffscreenY = 13000;


	let popupAdjustmentWidth = 0;
	let popupAdjustmentHeight = 0;
	let isVisible = false;
	let type = "window";
	let windowID;
	let tabID;
	let lastActiveTab;


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


	function calcPosition(
		targetWindow)
	{
		const {left: targetX, top: targetY, width: targetW, height: targetH} = targetWindow;
		const width = PopupInnerWidth + popupAdjustmentWidth;
		const height = PopupInnerHeight + popupAdjustmentHeight;
		const left = Math.max(0, targetX + Math.floor((targetW - width) / 2));
		const top = Math.max(0, targetY + Math.floor((targetH - height) / 2));

		return { left, top, width, height };
	}


	async function create(
		activeTab,
		focusSearch)
	{
			// close any existing window, in case wasn't already closed
		await close();

		const targetWindow = await cp.windows.get(activeTab.windowId);
		const url = `popup.html?${new URLSearchParams({ type, focusSearch })}`;
		let {left, top, width, height} = calcPosition(targetWindow);
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
				// first add the tab to the last unfocused window, then show()
				// move that tab to a new popup window
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
				// store the adjustments needed to get the target size so that
				// the next time we open the window, it'll be the right size.
				// then adjust the new window to the correct size.
			popupAdjustmentWidth += widthDelta;
			popupAdjustmentHeight += heightDelta;
			width += popupAdjustmentWidth;
			height += popupAdjustmentHeight;

			await cp.windows.update(window.id, { width, height });
		}

		lastActiveTab = activeTab;
		isVisible = true;

		return window;
	}


	async function show(
		activeTab)
	{
		const targetWindow = await cp.windows.get(activeTab.windowId);
		let {left, top, width, height} = calcPosition(targetWindow);
		let result = Promise.resolve();

		lastActiveTab = activeTab;
		isVisible = true;

		if (type == "window" && windowID) {
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

		return result.catch(console.error);
	}


	async function hide(
		unfocus)
	{
		let result = Promise.resolve();

		isVisible = false;

		if (type == "window" && windowID) {
			const options = {
				left: OffscreenX,
				top: OffscreenY
			};

			if (unfocus) {
				options.focused = false;
			}

			result = cp.windows.update(windowID, options);
		} else if (type == "tab" && tabID) {
			const lastWindow = await getLastWindow();

			result = cp.tabs.move(tabID, {
				windowId: lastWindow.id,
				index: -1
			});
		}

		return result.catch(console.error);
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
