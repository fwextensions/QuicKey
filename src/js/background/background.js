const TabActivatedOnStartupDelay = 750;


let gStartingUp = false;
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
	"background/toolbar-icon",
	"background/recent-tabs",
	"background/page-trackers",
	"background/quickey-storage",
	"background/settings",
	"background/constants"
], function(
	cp,
	popupWindow,
	toolbarIcon,
	recentTabs,
	trackers,
	storage,
	settings,
	k
) {
		// if the popup is opened and closed within this time, switch to the
		// previous tab
	const MaxPopupLifetime = 450;
	const TabRemovedDelay = 1000;
	const RestartDelay = 10 * 1000;
	const {
		OpenPopupCommand,
		PreviousTabCommand,
		NextTabCommand,
		ToggleTabsCommand,
		FocusPopupCommand
	} = k.CommandIDs;
	const MessageHandlers = {
			// bring the tab's window forward *before* focusing the tab, since
			// activating the window can sometimes put keyboard focus on the
			// very first tab button on macOS 10.14 (could never repro on
			// 10.12).  then focus the tab, which should fix any focus issues.
		focusTab: ({tab: {id, windowId}, options = {}}) =>
			cp.windows.update(windowId, { focused: true })
				.then(() => cp.tabs.update(id, { active: true, ...options }))
				.catch(error => {
					backgroundTracker.exception(error);
					console.error(error);
				}),
		restoreSession: ({sessionID}) => cp.sessions.restore(sessionID),
		createWindow: ({url}) => cp.windows.create({ url }),
		createTab: ({url}) => cp.tabs.create({ url }),
		setURL: ({tabID, url}) => cp.tabs.update(tabID, { url })
	};


	const backgroundTracker = trackers.background;
	const ports = {};
	let lastTogglePromise = Promise.resolve();
	let currentWindowLimitRecents = false;
	let navigateRecentsWithPopup = true;
	let navigatingRecents = false;
	let activeTab;
	let lastWindowID;
	let lastUsedVersion;
	let usePinyin;


	const addTab = debounce(
		({tabId}) => cp.tabs.get(tabId)
			.then(recentTabs.add)
			.catch(error => {
					// ignore the "No tab with id:" errors, which will happen
					// closing a window with multiple tabs.  since addTab()
					// is debounced and will fire after the window is closed,
					// the tab no longer exists at that point.
				if (error && error.message && error.message.indexOf("No tab") != 0) {
					backgroundTracker.exception(error);
				}
			}),
		k.MinTabDwellTime
	);


	const handleTabRemoved = debounce(
		(tabId, removeInfo) => !gStartingUp && recentTabs.remove(tabId, removeInfo),
		TabRemovedDelay
	);


	async function handleTabActivated(
		event)
	{
			// don't add the popup window to the recent tabs.  even though
			// recentTabs.add() will ignore the popup window, we don't want to
			// notify the popup about its own activation, which would happen
			// because the last tab in tabIDs wouldn't match the event.  if the
			// user is navigating through tabs and activating each one as it's
			// selected, we don't want to update the recents list until they
			// finish and the window closes.
		if (event.windowId !== popupWindow.id && !navigatingRecents) {
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
				navigateRecents(-1);
				break;

			case NextTabCommand:
//				tabChangedFromCommand = true;
//				recentTabs.navigate(1, currentWindowLimitRecents);
//				backgroundTracker.event("recents", "next", label);
				navigateRecents(1);
				break;

			case ToggleTabsCommand:
				toggleRecentTabs(true);
				break;
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


	async function openPopupWindow(
		focusSearch = false)
	{
		[activeTab] = await cp.tabs.query({
			active: true,
			lastFocusedWindow: true
		});
		navigatingRecents = false;

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


	async function navigateRecents(
		direction)
	{
			// track whether the user is navigating farther back in the stack
		const label = toolbarIcon.isNormal ? "single" : "repeated";
		const action = direction == -1 ? "previous" : "next";

		if ((ports.popup && popupWindow.isVisible && !navigatingRecents) || ports.menu) {
				// for recentTabs.navigate(), -1 is further back in the stack,
				// but for the menu, 1 is moving the selection down, which is
				// equivalent to going further back in the stack, so negate
				// the value
			sendPopupMessage("modifySelected", {
				direction: -direction
			});
		} else {
			if (navigateRecentsWithPopup) {
				if (!popupWindow.isOpen || !ports.popup) {
						// execute any pending tab activation event so the recents
						// list is up-to-date before we start navigating
					await addTab.execute();
					await openPopupWindow();
				} else if (!popupWindow.isVisible) {
						// make the activeTab empty, so that the current tab
						// won't be filtered out in the recents list
					activeTab = {};
				}

				navigatingRecents = true;
				sendPopupMessage("modifySelected", {
					direction: -direction,
					openPopup: true
				});
			} else {
					// don't invert the icon if the user presses the switch to
					// next shortcut when they're not actively navigating so
					// that it doesn't invert for no reason
				if (direction == -1 || !toolbarIcon.isNormal) {
					toolbarIcon.invertFor(k.MinTabDwellTime);
				}

				recentTabs.navigate(direction);
			}

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
			// and the wrong tab is navigated to.  even if we made this an async
			// function, we'd still have to store the promise it returns somewhere
			// and await that before calling this function again; otherwise, the
			// event handler would keep starting new chains.  seems cleanest to
			// keep the promise chain handling just within this function.
		lastTogglePromise = lastTogglePromise
				// if the user navigated to a tab but hasn't waited for the min
				// dwell time before toggling back, add the current tab before
				// toggling so it becomes the most recent
			.then(addTab.execute)
			.then(() => {
				if (navigatingRecents) {
						// tell the popup that the user's no longer navigating
						// recents, so that when it gets blurred after we toggle
						// to the previous tab, it'll close itself
					sendPopupMessage("stopNavigatingRecents");
				}

				navigatingRecents = false;
			})
			.then(recentTabs.toggle)
				// fire the debounced addTab() so the tab we just toggled to will
				// be the most recent, in case the user quickly toggles again.
				// otherwise, the debounced add would fire after we navigate,
				// putting that tab on the top of the stack, even though a
				// different tab was now active.
			.then(addTab.execute)
			.then(() => backgroundTracker.event("recents",
				fromShortcut ? "toggle-shortcut" : "toggle"));
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
			// so we don't add two listeners
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
		toolbarIcon.updateTabCount(1);

		if (!gStartingUp && !tab.active && tab.windowId !== popupWindow.id) {
				// this tab was opened by ctrl-clicking a link or by opening
				// all the tabs in a bookmark folder, so pass true to insert
				// this tab in the penultimate position, which makes it the
				// "most recent" tab
			recentTabs.add(tab, true);
		}
	});


	chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
		toolbarIcon.updateTabCount(-1);

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


	chrome.runtime.onMessage.addListener(async ({message, ...payload}, sender, sendResponse) => {
		const handler = MessageHandlers[message];

		if (handler) {
			sendResponse(await handler(payload));
			await addTab.execute();
		} else if (message === "stopNavigatingRecents") {
			navigatingRecents = false;
		} else if (message === "executeAddTab") {
			await addTab.execute();
		} else if (message === "getActiveTab") {
			sendResponse(activeTab);
		} else if (message === "settingChanged") {
			const {key, value} = payload;

			if (key == k.ShowTabCount.Key) {
				toolbarIcon.showTabCount(value);
			} else if (key == k.CurrentWindowLimitRecents.Key) {
				currentWindowLimitRecents = value;
			} else if (key == k.PopupType.Key) {
				popupWindow.type = value;
			}
		}

		return true;
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
		// close them so they're not left in a weird state
	cp.tabs.query({
		url: `chrome-extension://${chrome.runtime.id}/*`
	})
		.then(tabs => cp.tabs.remove(tabs.map(({id}) => id)))
		.catch(console.error);

		// show the tab count, if necessary, and set the popup window type
	settings.get()
		.then(settings => {
			toolbarIcon.showTabCount(settings[k.ShowTabCount.Key]);
			currentWindowLimitRecents = settings[k.CurrentWindowLimitRecents.Key];
			popupWindow.type = settings[k.PopupType.Key];
		});

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
			lastUsedVersion: chrome.runtime.getManifest().version
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
