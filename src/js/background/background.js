	// if the popup is opened and closed within this time, switch to the
	// previous tab
const MaxPopupLifetime = 450;
const TabActivatedOnStartupDelay = 750;
const TabRemovedDelay = 1000;
const MinTabDwellTime = 750;
const RestartDelay = 10 * 1000;
const BadgeColors = {
	light: {
		normal: "#777",
		inverted: "#3367d6"
	},
	dark: {
		normal: "#666",
		inverted: "#3367d6"
	}
};
const IconPaths = {
	light: {
		normal: {
			path: {
				"19": "img/icon-19.png",
				"38": "img/icon-38.png"
			}
		},
		inverted: {
			path: {
				"19": "img/icon-19-inverted.png",
				"38": "img/icon-38-inverted.png"
			}
		}
	}
};
IconPaths.dark = {
	normal: IconPaths.light.inverted,
	inverted: IconPaths.light.normal
};
const Manifest = chrome.runtime.getManifest();


let gStartingUp = false;
let gIgnoreNextTabActivation = false;
let gInstalledPromise = new Promise(resolve => {
	chrome.runtime.onInstalled.addListener(details => resolve(details));
});


function debounce(
	func,
	wait,
	thisArg = this)
{
	let timeout;
	let exec;


	const debouncedFunc = (...args) => {
		exec = () => {
				// clear the timer in case we're being called by execute() so
				// that we don't get called twice
			debouncedFunc.cancel();

				// return the result of func, in case we're being called by
				// execute() and it returns a promise, so the caller can chain it
			return func.apply(thisArg, args);
		};


		clearTimeout(timeout);
		timeout = setTimeout(exec, wait);
	};


	debouncedFunc.cancel = () => {
		clearTimeout(timeout);
		timeout = null;
		exec = null;
	};


	debouncedFunc.execute = () => Promise.resolve(exec && exec());


	return debouncedFunc;
}


chrome.runtime.onStartup.addListener(() => {
	const onActivated = debounce(() => {
		chrome.tabs.onActivated.removeListener(onActivated);

DEBUG && console.log("==== last onActivated");

			// we only need to call updateAll() if Chrome is still starting up,
			// since gStartingUp will be set to false when the popup opens,
			// which will also update all the tabs
		if (gStartingUp) {
			require([
				"background/recent-tabs"
			], function(
				recentTabs
			) {
					// the stored recent tab data will be out of date, since the tabs
					// will get new IDs when the app reloads each one
				return recentTabs.updateAll()
					.then(() => {
DEBUG && console.log("===== updateAll done");

						gStartingUp = false;
					});
			});
		}
	}, TabActivatedOnStartupDelay);

DEBUG && console.log("== onStartup");

	gStartingUp = true;
	chrome.tabs.onActivated.addListener(onActivated);
});


require([
	"cp",
	"background/popup-window",
	"background/recent-tabs",
	"background/page-trackers",
	"background/quickey-storage",
	"background/settings",
	"background/constants"
], function(
	cp,
	popupWindow,
	recentTabs,
	trackers,
	storage,
	settings,
	k
) {
	const {
		OpenPopupCommand,
		PreviousTabCommand,
		NextTabCommand,
		ToggleTabsCommand,
		FocusPopupCommand
	} = k.CommandIDs;


	const backgroundTracker = trackers.background;
	const ports = {};
	let tabCount = 0;
	let lastTogglePromise = Promise.resolve();
	let isNormalIcon = true;
	let showTabCount = true;
	let currentWindowLimitRecents = false;
	let activeTab;
	let shortcutTimer;
	let lastWindowID;
	let lastUsedVersion;
	let usePinyin;


	const addTab = debounce(({tabId}) => cp.tabs.get(tabId)
		.then(recentTabs.add)
		.catch(error => {
				// ignore the "No tab with id:" errors, which will happen
				// closing a window with multiple tabs.  since addTab()
				// is debounced and will fire after the window is closed,
				// the tab no longer exists at that point.
			if (error && error.message && error.message.indexOf("No tab") != 0) {
				backgroundTracker.exception(error);
			}
		}), MinTabDwellTime);


	const handleTabRemoved = debounce((tabId, removeInfo) => {
		if (!gStartingUp) {
			recentTabs.remove(tabId, removeInfo);
		}
	}, TabRemovedDelay);


	function handleTabActivated(
		event)
	{
			// don't add the popup window to the recent tabs.  even though
			// recentTabs.add() will ignore the popup window, we don't want to
			// notify the popup about its own activation, which would happen
			// because the last tab in tabIDs wouldn't match the event.
		if (!gIgnoreNextTabActivation && event.windowId !== popupWindow.id) {
			addTab(event);

			if (ports.popup) {
				storage.get(({tabIDs}) => {
						// if the newly activated tab is the same as the most
						// recent one in tabIDs, that means it was just
						// reactivated after the popup was hidden, so we don't
						// need to tell the popup to re-render
					if (event.tabId !== tabIDs.slice(-1)[0]) {
						sendPopupMessage("tabActivated");
					}
				});
			}
		}

		gIgnoreNextTabActivation = false;
	}


	function handleCommand(
		command)
	{
		switch (command) {
			case OpenPopupCommand:
				openPopupWindow();
				break;

			case FocusPopupCommand:
				openPopupWindow(true);
				break;

			case PreviousTabCommand:
//				tabChangedFromCommand = true;
//				recentTabs.navigate(-1, currentWindowLimitRecents);
//				backgroundTracker.event("recents", "previous", label);
				navigateTabs(-1);
				break;

			case NextTabCommand:
//				tabChangedFromCommand = true;
//				recentTabs.navigate(1, currentWindowLimitRecents);
//				backgroundTracker.event("recents", "next", label);
				navigateTabs(1);
				break;

			case ToggleTabsCommand:
				toggleRecentTabs(true);
				break;
		}
	}


	function toggleRecentTabs(
		fromShortcut)
	{
			// we have to wait for the last toggle promise chain to resolve before
			// starting the next one.  otherwise, if the toggle key is held down,
			// the events fire faster than recentTabs.toggle() can keep up, so
			// the tabIDs array isn't updated before the next navigation happens,
			// and the wrong tab is navigated to.
		lastTogglePromise = lastTogglePromise
				// if there's a debounced addTab() call waiting, fire it now, so
				// that when we navigate to the "previous" tab below, that'll be
				// the tab the user started from when they began navigating
				// backwards into the stack.  otherwise, the debounced add would
				// fire after we navigate, putting that tab on the top of the
				// stack, even though a different tab was now active.
			.then(addTab.execute)
			.then(() => recentTabs.toggle(currentWindowLimitRecents))
				// fire the debounced addTab() so the tab we just toggled to will
				// be the most recent, in case the user quickly toggles again.
				// otherwise, the debounced add would fire after we navigate,
				// putting that tab on the top of the stack, even though a
				// different tab was now active.
			.then(addTab.execute)
			.then(() => backgroundTracker.event("recents",
				fromShortcut ? "toggle-shortcut" : "toggle"));
	}


	async function openPopupWindow(
		focusSearch = false)
	{
		[activeTab] = await cp.tabs.query({
			active: true,
			lastFocusedWindow: true
		});

		if (!popupWindow.isOpen || !ports.popup) {
				// the popup window isn't open, so create a new one, with the
				// search box either focused or not
			popupWindow.create(activeTab, focusSearch);
		} else if (activeTab.windowId !== popupWindow.id) {
				// the popup window isn't focused, so tell it to show itself
				// centered on the current browser window, and whether to
				// select the first item
			sendPopupMessage("showWindow", { focusSearch, activeTab });
		} else {
				// it's open and focused, so use the shortcut to move the
				// selection DOWN
			if (sendPopupMessage("modifySelected", { direction: 1 })) {
					// an error was returned from sending the message, so close
					// the popup
				popupWindow.close();
			}
		}
	}


	function sendPopupMessage(
		message,
		payload = {})
	{
		try {
				// default to sending the message to the menu if it's open
			(ports.menu || ports.popup).postMessage({ message, ...payload });
		} catch (error) {
			return error;
		}
	}


	function navigateTabs(
		direction)
	{
		if ((ports.popup && popupWindow.isVisible) || ports.menu) {
				// for recentTabs.navigate(), -1 is further back in the stack,
				// but for the menu, 1 is moving the selection down, which is
				// equivalent to going further back in the stack, so negate
				// the value
			sendPopupMessage("modifySelected", { direction: -direction });
		} else {
				// track whether the user is navigating farther back in the stack
			const label = isNormalIcon ? "single" : "repeated";
			const action = direction == -1 ? "previous" : "next";

				// don't invert the icon if the user presses the switch to next
				// shortcut when they're not actively navigating so that it
				// doesn't invert for no reason
			if (direction == -1 || !isNormalIcon) {
				setInvertedIcon();
			}

			recentTabs.navigate(direction);
			backgroundTracker.event("recents", action, label);
		}
	}


	function toggleRecentTabs(
		fromShortcut)
	{
			// we have to wait for the last toggle promise chain to resolve before
			// starting the next one.  otherwise, if the toggle key is held down,
			// the events fire faster than recentTabs.toggle() can keep up, so
			// the tabIDs array isn't updated before the next navigation happens,
			// and the wrong tab is navigated to.
		lastTogglePromise = lastTogglePromise
				// if there's a debounced addTab() call waiting, fire it now, so
				// that when we navigate to the "previous" tab below, that'll be
				// the tab the user started from when they began navigating
				// backwards into the stack.  otherwise, the debounced add would
				// fire after we navigate, putting that tab on the top of the
				// stack, even though a different tab was now active.
			.then(addTab.execute)
			.then(recentTabs.toggle)
			.then(() => backgroundTracker.event("recents",
				fromShortcut ? "toggle-shortcut" : "toggle"));
	}


	function activateLastTab()
	{
		setNormalIcon();

			// make sure any pending addTab is finished, so that when we get the
			// tab data out of storage, the order will be correct
		addTab.execute()
				// execute() will return the tab data from recentTabs.add(), but
				// if there wasn't a pending add for some reason, it's simpler
				// to just always get the data from storage
			.then(() => storage.get(({tabIDs, tabsByID}) => {
				const [previousTabID, currentTabID] = tabIDs.slice(-2);
				const previousTab = tabsByID[previousTabID];
				const currentTab = tabsByID[currentTabID];

				if (previousTab && currentTab &&
						previousTab.windowId !== currentTab.windowId) {
						// the previous tab is in another window, and the user
						// might have activated other tabs in that window before
						// getting to the current tab, so check
					cp.tabs.get(previousTabID)
						.then(({active}) => {
							if (!active) {
									// the previous tab isn't active, so activate
									// it, so that if the user than alt-tabs back
									// to that window, the previous tab will
									// already be visible.  make sure
									// handleTabActivated() ignores this event.
								gIgnoreNextTabActivation = true;
								cp.tabs.update(previousTabID, { active: true })
									.catch(console.error);
							}
						});
				}
			}));
	}


	function getIconsAndBadgeColor(
		inverted)
	{
		const osMode = matchMedia("(prefers-color-scheme: dark)").matches ?
			"dark" : "light";
		const iconMode = inverted ? "inverted" : "normal";
		const paths = IconPaths[osMode][iconMode];
		const badgeColor = BadgeColors[osMode][iconMode];

		return { paths, badgeColor };
	}


	function setInvertedIcon()
	{
			// only reactivate the last tab in dev mode for now
		const handler = k.IsDev ? activateLastTab : setNormalIcon;
			// pass true since we want the inverted colors
		const {paths, badgeColor} = getIconsAndBadgeColor(true);

		isNormalIcon = false;
		clearTimeout(shortcutTimer);
		shortcutTimer = setTimeout(handler, MinTabDwellTime);

		return Promise.all([
			showTabCount
			? cp.browserAction.setBadgeBackgroundColor({ color: badgeColor })
			: cp.browserAction.setIcon(paths)
		])
			.catch(backgroundTracker.exception);
	}


	function setNormalIcon()
	{
		const {paths, badgeColor} = getIconsAndBadgeColor();

		isNormalIcon = true;
		cp.browserAction.setIcon(paths);

		return Promise.all([
			cp.browserAction.setBadgeBackgroundColor({ color: badgeColor }),
			cp.browserAction.setIcon(paths)
		])
			.catch(backgroundTracker.exception);
	}


	function updateTabCount(
		delta = 0)
	{
		tabCount += delta;

		const name = Manifest.short_name;
		const text = showTabCount
			? String(tabCount)
			: "";
			// Edge appends the badge count with a comma after the badge title,
			// which looks awkward: "829 open tabs, 829".  so don't customize
			// the title in Edge.
		const title = showTabCount && !k.IsEdge
			? `${name} - ${tabCount} open tab${tabCount == 1 ? "" : "s"}`
			: name;

		return Promise.all([
			cp.browserAction.setBadgeText({ text }),
			cp.browserAction.setTitle({ title })
		])
			.catch(backgroundTracker.exception);
	}


	function onCommandListener(
		command)
	{
		if (!gStartingUp) {
			handleCommand(command);
		} else {
				// as below in the onConnect handler, the user is interacting
				// with the extension before the last onActivated event happened,
				// so we're clearly not starting up anymore.  since the onActivated
				// handler didn't call updateAll(), we need to do that before
				// handling the command.  otherwise, the stored tab IDs are likely
				// to be out of sync with the reopened tabs and navigation will fail.
			gStartingUp = false;
			recentTabs.updateAll()
				.then(() => handleCommand(command));
		}
	}


	function enableCommands()
	{
			// just in case the listener hasn't already been removed, call this
			// so we don'd add two listeners
		disableCommands();
		chrome.commands.onCommand.addListener(onCommandListener);
	}


	function disableCommands()
	{
		chrome.commands.onCommand.removeListener(onCommandListener);
	}


	chrome.tabs.onActivated.addListener(event => {
		if (!gStartingUp) {
			handleTabActivated(event);
		}
	});


	chrome.tabs.onCreated.addListener(tab => {
		updateTabCount(1);

		if (!gStartingUp && !tab.active && tab.windowId !== popupWindow.id) {
				// this tab was opened by ctrl-clicking a link or by opening
				// all the tabs in a bookmark folder, so pass true to insert
				// this tab in the penultimate position, which makes it the
				// "most recent" tab
			recentTabs.add(tab, true);
		}
	});


	chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
		updateTabCount(-1);

			// debounce the handling of a removed tab since Chrome seems to
			// trigger the event when shutting down, and we want to ignore
			// those.  hopefully, Chrome will finish quitting before this
			// handler fires.  we don't debounce the listener because we want
			// to update the tab count immediately above.
		handleTabRemoved(tabId, removeInfo);
	});


		// tabs seem to get replaced with new IDs when they're auto-discarded by
		// Chrome, so we want to update any recency data for them
	chrome.tabs.onReplaced.addListener((newID, oldID) => {
		if (!gStartingUp) {
			recentTabs.replace(oldID, newID);
		}
	});


		// the onActivated event isn't fired when the user switches between
		// windows, so get the active tab in this window and store it
	chrome.windows.onFocusChanged.addListener(windowID => {
			// check this event's windowID against the last one we saw and
			// ignore the event if it's the same.  that happens when the popup
			// opens and no tab is selected or the user's double-pressing.
		if (!gStartingUp && windowID != chrome.windows.WINDOW_ID_NONE &&
				windowID != lastWindowID) {
			lastWindowID = windowID;
			cp.tabs.query({ active: true, windowId: windowID })
					// pass just the tabId to handleTabActivated(), even though we
					// have the full tab, since most of the time, handleTabActivated()
					// will be called by onActivated, which only gets the tabId.
					// this simplifies the logic in handleTabActivated().  if this
					// window somehow doesn't have an active tab, which should
					// never happen, it'll pass undefined to addTab(), which
					// will catch the exception.
				.then(([tab = {}]) => handleTabActivated({
					tabId: tab.id,
					windowId: windowID
				}));
		}
	});


	chrome.runtime.onConnect.addListener(port => {
		const connectTime = Date.now();
		let closedByEsc = false;

			// in newer versions of Chrome, reopened tabs don't trigger an
			// onActivated event, so the handler set in onStartup won't fire
			// until the first tab is manually activated.  set gStartingUp to
			// false here in case the user opens the menu before that happens.
		gStartingUp = false;
		ports[port.name] = port;

		if (port.name == "menu") {
			disableCommands();
		}

		port.onMessage.addListener(message => {
			closedByEsc = (message == "closedByEsc");
		});

		port.onDisconnect.addListener(port => {
			ports[port.name] = null;
			activeTab = null;

			if (port.name == "popup") {
				popupWindow.close();
			} else {
				enableCommands();
			}

			if (!closedByEsc && Date.now() - connectTime < MaxPopupLifetime) {
					// this was a double-press of alt-Q, so toggle the tabs
				toggleRecentTabs();
			} else {
					// send a background "pageview", since the popup is now closed,
					// so that GA will track the time the popup was open
				backgroundTracker.pageview();
			}
		});
	});


	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message == "getActiveTab") {
			sendResponse(activeTab);
		} else if (k.ShowTabCount.Key in message) {
			showTabCount = message[k.ShowTabCount.Key];

				// set the normal icon, in case the user switched modes after
				// the background page was loaded, then add the badge
			setNormalIcon()
				.then(() => updateTabCount());
		} else if (k.CurrentWindowLimitRecents.Key in message) {
			currentWindowLimitRecents = message[k.CurrentWindowLimitRecents.Key];
		} else if (k.PopupType.Key in message) {
			popupWindow.type = message[k.PopupType.Key];
		}
	});


	chrome.runtime.onUpdateAvailable.addListener(details => {
		function restartExtension()
		{
			if (!ports.menu) {
DEBUG && console.log("=== reloading");
				chrome.runtime.reload();
			} else {
				setTimeout(restartExtension, RestartDelay);
			}
		}

		try {
			backgroundTracker.event("extension", "update-available",
				details && details.version);
		} catch (e) {
DEBUG && console.log(e);
		}

		restartExtension();
	});


	window.log = function(...args) {
		DEBUG && console.log.apply(console, args);
	};

	enableCommands();

		// if any of our tabs were already open when we're getting reloaded,
		// close them
	cp.tabs.query({
		url: `chrome-extension://${chrome.runtime.id}/*`
	})
		.then(tabs => cp.tabs.remove(tabs.map(({id}) => id)))
		.catch(console.error);

		// update the icon, in case we're in dark mode when the extension loads,
		// and update the badge text depending on the setting of showTabCount
	settings.get()
		.then(settings => {
			showTabCount = settings[k.ShowTabCount.Key];
			currentWindowLimitRecents = settings[k.CurrentWindowLimitRecents.Key];
			popupWindow.type = settings[k.PopupType.Key];
		})
		.then(() => setNormalIcon())
		.then(() => cp.tabs.query({}))
		.then(({length}) => updateTabCount(length));

	storage.set(data => {
			// save the lastUsedVersion in a global before we return the current
			// version below, so the onInstalled promise handler knows whether
			// to open the options page.  of course, to do that, we need to make
			// sure that promise is handled as part of the chain started from
			// getting the lastUsedVersion.  otherwise, the onInstalled promise
			// below would always think it was being updated.
		({lastUsedVersion, settings: {usePinyin}} = data);

			// save the current time and version in settings so recentTabs.getAll()
			// knows whether it needs to update the stored data
		return {
			lastStartupTime: Date.now(),
			lastUsedVersion: Manifest.version
		};
	})
		.then(() => cp.management.getSelf())
		.then(info => {
			const installType = (info.installType == "development") ? "D" : "P";
			const dimensions = {
				"dimension1": info.version,
				"dimension2": installType
			};

			if (installType == "D") {
					// changing a constant at runtime is gross, but here we are
				k.IsDev = true;
			}

			backgroundTracker.set(dimensions);
			trackers.popup.set(dimensions);
			trackers.options.set(dimensions);

			backgroundTracker.pageview();
			backgroundTracker.timing("loading", "background", performance.now());
DEBUG && console.log("=== startup done", performance.now());
		})
			// pause the chain to wait for the installed promise to resolve,
			// which it will never do if the event doesn't fire.  if it does,
			// it should do so before we get here, but we use a promise just
			// in case it doesn't for some reason.
		.then(() => gInstalledPromise)
		.then(({reason, previousVersion}) => {
			backgroundTracker.event("extension", reason, previousVersion);

			if (reason == "update" && lastUsedVersion == "1.4.0" && usePinyin) {
					// open the options page with an update message for people
					// who had previously installed QuicKey and have their
					// language set to Chinese or who have open tabs with
					// Chinese characters
				chrome.tabs.create({
					url: chrome.extension.getURL("options.html?pinyin")
				});
				backgroundTracker.event("extension", "open-options");
			}
		})
		.catch(error => backgroundTracker.exception(error));
});
