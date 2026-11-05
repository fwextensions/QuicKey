import { enqueue } from "@/shared/enqueue";
import control from "@/shared/control";
import { addListener, removeListener } from "@/shared/controlledEvent";
import popupWindow from "@/background/popup-window";
import toolbarIcon from "@/background/toolbar-icon";
import recentTabs from "@/background/recent-tabs";
import trackers from "@/background/page-trackers";
import { isPopupWindow, isMenuOpen, whenMenuClosed } from "@/background/popup-utils";
import * as k from "@/background/constants";
import log from "@/background/persistent-log";

const {
	OpenPopupCommand,
	PreviousTabCommand,
	NextTabCommand,
	ToggleTabsCommand,
	FocusPopupCommand
} = k.CommandIDs;

const tracker = trackers.background;
const isBackgroundContext = typeof document === "undefined";


	// report a failed command once, the same way other caught errors are, and
	// let the command queue it came from carry on
function handleCommandError(
	error)
{
	tracker.exception(error);
	console.error(error);
}


	// whenSettingsLoaded() returns a promise for the settings the commands
	// depend on having been loaded by the controller, which on a cold start
	// can finish after the command that woke the worker arrives
export default function createCommandHandlers({
	state,
	addTab,
	popupLink,
	whenSettingsLoaded = () => Promise.resolve() })
{
	let lastTogglePromise = Promise.resolve();
		// when the last command in the lastTogglePromise queue finished.  those
		// commands switch tabs, so the active tab a shortcut was pressed on is
		// out of date once one of them finishes after the press.
	let lastRecentsCommandEnd = 0;
	let lastOpenPromise = Promise.resolve();

		// whether the toolbar menu is open, tracked through its port connecting
		// and disconnecting.  chrome broadcasts runtime.onConnect to every
		// extension context, so this is correct in whichever context handles
		// commands.  null means this context hasn't seen a menu port event yet
		// (it may have started while the menu was already open), so the tracked
		// state can't be trusted and we ask the browser instead.
	let menuOpen = null;

		// while the menu is open, we remove the commands.onCommand listener
		// entirely, so that Chrome delivers shortcuts like alt-W to the menu as
		// normal keydown/keyup events instead of intercepting them as global
		// commands.  the menu's select-on-modifier-release behavior depends on
		// seeing the raw key events, so just ignoring the command in this
		// context isn't enough.  that only works if NO context in the whole
		// extension has an onCommand listener, so the hidden popup page must
		// not register one unless it actually holds control (the worker died).
		// otherwise, its listener keeps Chrome intercepting the shortcut even
		// after the worker removes its own, especially if the hidden page is
		// frozen and can't respond to the menu's connect event.
	function shouldListenForCommands()
	{
		return isBackgroundContext || control.isHeld();
	}

		// log each change to whether this context listens for commands, since a
		// listener that never gets re-added would make every shortcut silently do
		// nothing, with no sign of it in handleCommand()'s own logging
	let commandsEnabled = false;

	function enableCommands(
		reason)
	{
		if (shouldListenForCommands()) {
			addListener("commands.onCommand", handleCommand);

			if (!commandsEnabled) {
				commandsEnabled = true;
				log("commands enabled:", reason);
			}
		}
	}

	function disableCommands(
		reason)
	{
		removeListener("commands.onCommand", handleCommand);

		if (commandsEnabled) {
			commandsEnabled = false;
			log("commands disabled:", reason);
		}
	}

	let watchingMenuClose = false;

		// if this context started listening while the menu was already open
		// (like the worker being woken by the menu's port connect), disable
		// commands and re-enable them when the menu's lock is released.  we
		// can't rely on the menu's port disconnect here, since its port was
		// connected to the previous worker, so this context will never see it.
		// if the check fails, leave commands enabled, since handleCommand()
		// has its own menu check.
	function checkMenuNotAlreadyOpen()
	{
		isMenuOpen()
			.then((open) => {
				if (open && menuOpen !== false) {
					disableCommands("menu already open");
					watchForMenuClose();
				}
			})
			.catch(() => {});
	}

	function watchForMenuClose()
	{
		if (watchingMenuClose) {
			return;
		}

		watchingMenuClose = true;
		whenMenuClosed()
			.then(() => {
				menuOpen = false;
				enableCommands("menu lock released");
			})
			.catch(() => {})
			.finally(() => watchingMenuClose = false);
	}

	function handleMenuConnect(
		port)
	{
		if (port.name === "menu") {
			menuOpen = true;
			disableCommands("menu connected");
			port.onDisconnect.addListener(() => {
				menuOpen = false;
				enableCommands("menu disconnected");

					// the menu closes when the user picks a tab, so add that tab to
					// recents now, or quickly switching away would drop it.  only
					// the context with control can have an add pending.
				addTab.flush();
			});
		}
	}

		// while the menu is open on the toolbar icon, it handles keyboard events
		// itself, so all commands should be ignored until it closes.  otherwise,
		// a shortcut like alt-W that's both a menu navigation key and a global
		// command would also trigger the command in whichever context has
		// control, opening the popup window on top of the menu.
	async function shouldIgnoreCommands()
	{
		if (menuOpen === false) {
				// we saw the menu's port disconnect, so we know it's closed without
				// asking the browser.  never falling through to getContexts() here
				// means a stale POPUP context lingering after the menu closes can't
				// silently eat every subsequent command.
			return false;
		}

			// the tracked state is unknown or the menu looks open, so confirm
			// against live browser state.  if the call fails, fall back to the
			// tracked state rather than letting the rejection drop the command.
		return isMenuOpen().catch(() => menuOpen === true);
	}

		// numbers each command in the log, so its later steps can be matched up
	let commandCount = 0;

		// a command older than this when it gets its turn is dropped rather than
		// run.  when chrome.storage stalls, the storage lock can be held for 30 s
		// or more, and every toggle queued behind it would then flip tabs out from
		// under the user long after they gave up, the same hazard sw.js guards
		// against with MaxCachedEventAge for events replayed after a worker start.
		// it was 2 s, but a toggle pressed right after a cold start could spend
		// that long just flushing the replayed focus change's addTab, so it was
		// dropped even though the user was still waiting on it.
	const MaxCommandAge = 5000;
		// how long a toggle waits for the activation of the tab it switched to.
		// the activation normally lands within ~250 ms.  if the tab was already
		// active, none is coming, and without a limit the wait would hold up every
		// command queued behind it until the user switched tabs some other way.
	const MaxActivationWait = 1000;

		// log a command's progress through the queue, with the time since it
		// arrived, so a shortcut that seems to do nothing shows whether it was
		// never received, ignored, or stuck waiting on the previous command or a
		// lock.  the age is measured from receivedTime, not from being queued,
		// since handleCommand() can itself wait seconds on isMenuOpen() before
		// queuing.  fn gets a function that returns whether the command is now
		// too old, so it can bail out before a late side effect.  fn also gets an
		// endPhase(name) function, like the storage tasks', that records the time
		// since the previous phase.  the phases are logged with the finished line,
		// so a slow command shows which step the time went to.
	function trackCommand(
		command,
		fn,
		receivedTime = Date.now())
	{
		const id = ++commandCount;
		const elapsed = () => `${Date.now() - receivedTime} ms`;
		const phases = {};
		let phaseStart;
		const endPhase = (phase) => {
			const now = Date.now();

			phases[phase] = now - phaseStart;
			phaseStart = now;
		};
		const isStale = () => {
			const stale = Date.now() - receivedTime > MaxCommandAge;

			stale && log(`command #${id} dropped after`, elapsed());

			return stale;
		};

		log(`command #${id} queued:`, command, "after", elapsed());

		return async () => {
			log(`command #${id} started after`, elapsed());

			if (isStale()) {
				return;
			}

			phaseStart = Date.now();

			try {
				return await fn(isStale, endPhase);
			} finally {
				log(`command #${id} finished after`, elapsed(),
					...(Object.keys(phases).length ? [phases] : []));
			}
		};
	}


		// queue a command that can switch tabs behind the previous one, and record
		// when it finishes, so a later command can tell whether its shortcut's
		// tab is still the active one
	function enqueueRecentsCommand(
		task)
	{
		lastTogglePromise = enqueue(lastTogglePromise, async () => {
			try {
				return await task();
			} finally {
				lastRecentsCommandEnd = Date.now();
			}
		}, handleCommandError);
	}

	async function handleCommand(
		command,
		tab)
	{
		const receivedTime = Date.now();

		log("command received:", command, "menuOpen:", menuOpen);

		if (await shouldIgnoreCommands()) {
			log("command ignored, menu is open:", command);
			return;
		}

		switch (command) {
			case OpenPopupCommand:
			case FocusPopupCommand:
					// enqueue() keeps the chain going if a call throws.  we need to
					// wait for the previous call to openPopupWindow() to settle
					// before calling it again in case the user is spamming alt-Q.
					// without waiting, the second key press would find the
					// first one hadn't finished opening yet and tell the partially
					// loaded popup to close and open a new one.  rinse and repeat.
				lastOpenPromise = enqueue(lastOpenPromise,
					trackCommand(command,
						(isStale, endPhase) => openPopupWindow(command === FocusPopupCommand,
							isStale, endPhase, tab),
						receivedTime),
					handleCommandError);
				break;

			case PreviousTabCommand:
			case NextTabCommand:
				enqueueRecentsCommand(trackCommand(command, (isStale, endPhase) => whenSettingsLoaded().then(() => {
					endPhase("settings");

					return navigateRecents(
						command === PreviousTabCommand ? -1 : 1,
						state.currentWindowLimitRecents,
						endPhase,
						tab
					);
				}), receivedTime));
				break;

			case ToggleTabsCommand:
				toggleRecentTabs(true, receivedTime, tab);
				break;
		}
	}

		// commandTab is the active tab that onCommand passed, if any
	async function openPopupWindow(
		focusSearch = false,
		isStale = () => false,
		endPhase = () => {},
		commandTab)
	{
		const isOpen = await popupWindow.isOpen();

		endPhase("isOpen");

			// when there's no popup to show, use the tab the shortcut was pressed
			// in, which saves a tabs.query() that took 140-600 ms on a cold start
			// with a couple thousand tabs open.  if the popup is open, though,
			// query for the tab now.  commandTab is from when the key was pressed,
			// so for an alt-Q pressed again before the popup got focus, it'd be
			// the tab behind the popup, and we'd send showWindow, resetting the
			// selection instead of moving it down.
			// we used to set activeTab directly here, and then change it back to the
			// previous value in the last branch below.  that caused issues when we
			// were also awaiting popupWindow.isOpen().  if the user pressed alt-Q
			// quickly, a second command event could get handled while we were
			// awaiting isOpen().  the second invocation would then cache the previous
			// tab as the popup as well, causing it to send showWindow, which would
			// then reset the selection, making it impossible to move down quickly.
		const [currentActiveTab] = (!isOpen && commandTab)
			? [commandTab]
			: await chrome.tabs.query({
				active: true,
				lastFocusedWindow: true
			});

		endPhase("activeTab");

		if (!isOpen) {
				// create() needs the stored popup size, which waits on the storage
				// lock the first time.  that can take seconds on a cold start, so
				// read it here and check the command's age before opening a window
				// the user may have given up on.
			await popupWindow.seedSize();
			endPhase("seed");

			if (isStale()) {
				return;
			}

			state.activeTab = currentActiveTab;

				// the popup window isn't open, so create a new one.  tell it whether
				// to focus the search box or navigate recents.
			const result = await popupWindow.create(
				state.activeTab,
				{ focusSearch, navigatingRecents: state.navigatingRecents },
				state.navigatingRecents ? "right-center" : "center-center"
			);

			endPhase("create");

			return result;
		}

		if (popupLink.isMenuConnected()) {
				// the menu is open, so route the shortcut to it as a selection
				// change instead of showing the popup window.  popupLink.notify()
				// prefers the menu, and the menu can't handle showWindow (it has
				// no popupWindow connection), so sending it would just throw in
				// the menu and nothing would appear.
			return popupLink.notify("modifySelected", { direction: 1 });
		}

		if (!isPopupWindow(currentActiveTab)) {
			state.activeTab = currentActiveTab;

				// the popup window is open but not focused, so tell it to show
				// itself centered on the current browser window, and whether to
				// select the first item.  if there's no activeTab (such as when
				// the shortcut is pressed and a devtools window is in the
				// foreground), the popup will appear aligned to the screen.
			return popupLink.notify("showWindow", { focusSearch, activeTab: state.activeTab });
		}

			// the popup is open and focused, so use the shortcut to move the
			// selection DOWN
		if (!(await popupLink.notify("modifySelected", { direction: 1 }))) {
				// the message couldn't be delivered, so close the popup
			return popupWindow.close("modify-selected-failed");
		}
	}

	async function navigateRecents(
		direction,
		limitToCurrentWindow,
		endPhase = () => {},
		commandTab)
	{
			// track whether the user is navigating farther back in the stack
		const label = toolbarIcon.isNormal ? "single" : "repeated";
		const action = direction == -1 ? "previous" : "next";

		if ((popupLink.isPopupConnected() && popupWindow.isVisible && !state.navigatingRecents)
				|| popupLink.isMenuConnected()) {
				// for recentTabs.navigate(), -1 is further back in the stack,
				// but for the menu, 1 is moving the selection down, which is
				// equivalent to going further back in the stack, so negate
				// the value
			popupLink.notify("modifySelected", {
				direction: -direction
			});
		} else {
			if (state.navigateRecentsWithPopup) {
					// when navigating with recents, we want to ignore the "next"
					// direction if the window isn't currently visible, since that
					// would just mean navigating to the currently active tab
				if (direction == -1 || popupWindow.isVisible) {
					state.navigatingRecents = true;

						// execute any pending tab activation event so the recents
						// list is up-to-date before we start navigating.  we have to
						// do this regardless of whether the popup is open or not.
					await addTab.flush();
					endPhase("flush");

					if (!popupLink.isPopupConnected()) {
							// since the popup isn't currently open, we rely on it
							// to detect that it's being opened to navigate recents
							// and then change the selection instead of sending it
							// the modifySelected message below
						await openPopupWindow(false, undefined, endPhase, commandTab);
					} else {
						popupLink.notify("modifySelected", {
							direction: -direction,
							navigatingRecents: true
						});
					}
				}
			} else if (direction == -1 || !toolbarIcon.isNormal) {
					// we only want to invert the icon and start navigating if
					// the user is going backwards or is going forwards before
					// the cooldown ends
				await toolbarIcon.invertFor(k.MinTabDwellTime);
				await recentTabs.navigate(direction, limitToCurrentWindow);
				endPhase("navigate");
			}

				// this will record an event if the user hits alt-S when they're
				// not currently navigating, but probably not worth worrying about
			tracker.event("recents", action, label);
		}
	}

	function isAddableTab(
		tab)
	{
		return Number.isInteger(tab?.id)
			&& !isPopupWindow(tab)
			&& !state.navigatingRecents;
	}


		// returned below because background.js also calls this when the menu's
		// port disconnects right after connecting, which means the user
		// double-pressed the menu's shortcut to switch tabs
	function toggleRecentTabs(
		fromShortcut,
		receivedTime = Date.now(),
		activeTab)
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
		const command = fromShortcut ? ToggleTabsCommand : "toggle from double-press";
			// the shortcut's active tab, if we should add it before toggling
		let tabToAdd = null;

		enqueueRecentsCommand(trackCommand(command, (isStale, endPhase) => whenSettingsLoaded()
				// if the user navigated to a tab but hasn't waited for the min
				// dwell time before toggling back, the current tab has to become
				// the most recent before we toggle.  when the shortcut gave us the
				// active tab, toggle() adds it in the same storage task as the
				// switch, which on a cold start saves a separate read and write.
				// flushing isn't enough after a focus change, since that handler
				// has to query for the window's active tab before it calls
				// addTab(), so nothing is pending yet.  on a cold start, the
				// replayed onFocusChanged and onCommand are dispatched in the same
				// tick, so the flush always lost that race and toggled to the tab
				// that was already active.  cancel any add still scheduled for an
				// older tab, so it can't land after the switch.  skip the popup's
				// own tab, which addTab() would ignore, so that a real pending add
				// still gets flushed, and skip it while navigating recents, where
				// the active tab is just a preview.  also skip it if an earlier
				// command finished after this shortcut was pressed, since that
				// command may have switched tabs.  a toggle pressed while the
				// previous one was still running added the tab it had just left
				// back on top, then toggled to the tab that was already active, so
				// no activation came and every later toggle queued up behind it.
			.then(() => {
				endPhase("settings");
				tabToAdd = isAddableTab(activeTab) && receivedTime > lastRecentsCommandEnd
					? activeTab
					: null;

				if (tabToAdd) {
					addTab.cancel();
				} else {
					return addTab.flush();
				}
			})
			.then(() => {
				endPhase("flush");

				if (state.navigatingRecents) {
						// tell the popup that the user's no longer navigating
						// recents, so that when it gets blurred after we toggle
						// to the previous tab, it'll close itself
					popupLink.notify("stopNavigatingRecents");
				}

				state.navigatingRecents = false;

					// in case the user was navigating recents during a cooldown and
					// then hit the toggle command, reset the icon back to normal
				return toolbarIcon.setNormalIcon();
			})
				// don't return log()'s promise, which resolves only once the
				// batched entry is written, a second or more later
			.then(() => { log("toggle: pending addTab flushed, toggling"); })
				// the flush above waits on the storage lock, which can be held
				// for many seconds, so check the age again before switching.
				// toggle() itself waits on the lock too, so a stall that starts
				// after this point can still make the switch land late.  if it's
				// stale, still record the tab the user is on, since we canceled
				// any add that would have.
			.then(() => {
				if (isStale()) {
					return tabToAdd
						? addTab.now(tabToAdd.id).then(() => false)
						: false;
				}

				if (tabToAdd) {
						// addTab() would have set this when adding the tab
					state.activeTab = tabToAdd;
				}

				return recentTabs.toggle(state.currentWindowLimitRecents, tabToAdd);
			})
			.then((switched) => {
				endPhase("toggle");
				log("toggle: switched:", switched,
					switched ? "waiting for the activation" : "");

				return switched;
			})
				// fire the debounced addTab() so the tab we just toggled to will
				// be the most recent, in case the user quickly toggles again.
				// otherwise, the debounced add would fire after we navigate,
				// putting that tab on the top of the stack, even though a
				// different tab was now active.  if no add is pending yet, we need
				// to wait for the next one, which flushOrNext() will also fire
				// immediately rather than debouncing.
				// only wait if we actually switched, though.  otherwise no
				// activation is coming, and this chain would stall until the user
				// switched tabs some other way, with every toggle pressed in the
				// meantime queued up behind it.  switched only means the target
				// differs from the top of the stored recents, though, and if
				// those are out of date, the target can be the tab that's already
				// active.  so give up on the activation after MaxActivationWait,
				// and cancel the wait so the next add isn't rushed through.
			.then((switched) => switched && waitForActivation())
			.then(() => {
				endPhase("activation");
				tracker.event("recents",
					fromShortcut ? "toggle-shortcut" : "toggle");
			}),
			receivedTime));
	}


	function waitForActivation()
	{
		let timer;
		const timeout = new Promise((resolve) => {
			timer = setTimeout(() => {
				log("toggle: no activation after", MaxActivationWait, "ms, giving up");
				addTab.cancel();
				resolve();
			}, MaxActivationWait);
		});

		return Promise.race([addTab.flushOrNext(), timeout])
			.finally(() => clearTimeout(timer));
	}

	return {
			// the listeners are gated on control, so they can be added before this
			// context holds it
		listen()
		{
			chrome.runtime.onConnect.addListener(handleMenuConnect);
			enableCommands("init");
			checkMenuNotAlreadyOpen();
		},

			// this runs when the context takes control, which is the point where a
			// page context (the hidden popup) needs to start listening for
			// commands, since the worker is gone
		start()
		{
			enableCommands("took control");
			checkMenuNotAlreadyOpen();
		},

		toggleRecentTabs
	};
}
