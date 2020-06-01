define([
	"cp",
	"shared"
], (
	cp,
	shared
) => {
	const PopupInnerWidth = 500;
	const PopupInnerHeight = 488;
//	const OffscreenX = 2000;
//	const OffscreenY = 0;
	const OffscreenX = 13000;
	const OffscreenY = 13000;


	let popupAdjustmentWidth = 0;
	let popupAdjustmentHeight = 0;
	let window;
	let lastActiveTab;


	function calcPosition(
		targetWindow)
	{
		const {left: targetX, top: targetY, width: targetW, height: targetH} = targetWindow;
		const width = PopupInnerWidth + popupAdjustmentWidth;
		const height = PopupInnerHeight + popupAdjustmentHeight;
		const left = Math.max(0, targetX + Math.floor((targetW - width) / 2));
		const top = Math.max(0, targetY + Math.floor((targetH - height) / 2));

		return {left, top, width, height};
	}


	async function create(
		activeTab)
	{
			// close any existing window, in case wasn't already closed
		await close();

		const targetWindow = await cp.windows.get(activeTab.windowId);
		let {left, top, width, height} = calcPosition(targetWindow);

		window = await cp.windows.create({
			url: "popup.html",
			type: "popup",
			setSelfAsOpener: true,
			left,
			top,
			width,
			height
		});
		lastActiveTab = activeTab;

		const {width: innerWidth, height: innerHeight} = window.tabs[0];
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

		return window;
	}


	async function show(
		activeTab)
	{
		if (window) {
			const targetWindow = await cp.windows.get(activeTab.windowId);
			let {left, top} = calcPosition(targetWindow);

			await cp.windows.update(window.id, { focused: true, left, top });
			lastActiveTab = activeTab;
		}
	}


	async function hide(
		unfocus)
	{
		if (window) {
			const options = {
				left: OffscreenX,
				top: OffscreenY
			};

			if (unfocus) {
				options.focused = false;
			}

			await cp.windows.update(window.id, options);
		}
	}


	async function close()
	{
		if (window) {
			try {
				await cp.windows.remove(window.id);
			} catch (error) {
				console.error(error);
			}
		}

		window = null;
	}


	return shared("popupWindow", () => ({
		create,
		show,
		hide,
		close,
		get id() {
			return window && window.id;
		},
		get isOpen() {
			return window
				? chrome.extension.getViews({ windowId: window.id }).length == 1
				: false;
		},
		get activeTab() {
			return lastActiveTab;
		}
	}));
});
