	// the popup window's lifecycle, as the controller sees it.  transition()
	// is pure: it takes the current session and an event and returns the next
	// session and the effects the controller should carry out, in order.
	// nothing here touches chrome, so the whole thing can be tested as a
	// table, and every decision about what a shortcut does when the popup is
	// in some state is in one place.
	//
	// the session is plain data, so it travels with the controller's
	// snapshot when the worker hands control to the popup page.
	//
	// phases:
	//   closed    no popup page exists
	//   creating  create() has been asked for a window, but its page hasn't
	//             reported ready.  messages for the page are held in
	//             `pending` until it does, since the page can't handle them
	//             before its app has mounted, and would just drop them.
	//   visible   the window is showing and focused
	//   hidden    the page exists, but the window is hidden behind the
	//             focused window, stashed in a tab, or minimized
	//
	// events, from the commands:
	//   open       the open-popup or focus-search shortcut
	//   navigate   the previous-tab or next-tab shortcut
	//   stopNavigating  the toggle, or the page saying it's done navigating
	// and from the popup window and its page:
	//   created, shown, hidden, blurred, closed  the popup window's own events
	//   pageReady      the page has mounted and can take messages
	//   createAborted  create was given up on before a window was made
	//
	// effects:
	//   create          make the popup window
	//   notify          call a method on the page (or the menu, if it's open)
	//   flushAddTab     record any pending tab activation first
	//   navigateRecents switch tabs directly, without the popup
	//   track           an analytics event

export const Phase = {
	Closed: "closed",
	Creating: "creating",
	Visible: "visible",
	Hidden: "hidden",
};

const { Closed, Creating, Visible, Hidden } = Phase;


export function createSession()
{
	return {
		phase: Closed,
		navigatingRecents: false,
			// [name, payload] for the page, held until it's ready
		pending: null,
	};
}


const notify = (
	name,
	payload = {},
	options = {}) => ({ effect: "notify", name, payload, ...options });

const create = (
	focusSearch,
	navigatingRecents) => ({
		effect: "create",
		focusSearch,
		navigatingRecents,
		alignment: navigatingRecents ? "right-center" : "center-center",
	});


function handleOpen(
	session,
	{ focusSearch, menuOpen })
{
	if (menuOpen) {
			// the menu is open, so the shortcut moves its selection instead
			// of showing the popup window.  the menu can't handle showWindow,
			// so sending that would just throw there and nothing would appear.
		return [session, [notify("modifySelected", { direction: 1 })]];
	}

	switch (session.phase) {
		case Closed:
			return [
				{ ...session, phase: Creating },
				[create(focusSearch, session.navigatingRecents)],
			];

		case Creating:
				// a second press before the page is up.  once it is, move its
				// selection down, as if the popup had been open and focused.
			return [{ ...session, pending: ["modifySelected", { direction: 1 }] }, []];

		case Hidden:
				// tell the page to show itself over the active tab, and whether
				// to select the first item
			return [session, [notify("showWindow", { focusSearch })]];

		case Visible:
				// the popup is open and focused, so use the shortcut to move
				// the selection down.  if the message can't be delivered, the
				// page is gone, and the window should go too.
			return [session, [
				notify("modifySelected", { direction: 1 }, { closeIfUndelivered: true }),
			]];
	}

	return [session, []];
}


function handleNavigate(
	session,
	{ direction, menuOpen, withPopup, iconNormal })
{
	const { phase, navigatingRecents } = session;

	if (menuOpen || (phase === Visible && !navigatingRecents)) {
			// for recentTabs.navigate(), -1 is further back in the stack, but
			// for the menu and the popup, 1 is moving the selection down, which
			// is equivalent to going further back in the stack, so negate it
		return [session, [notify("modifySelected", { direction: -direction })]];
	}

	const effects = [];
	let next = session;

	if (withPopup) {
			// when navigating with the popup, ignore the "next" direction if
			// the window isn't visible, since that would just mean navigating
			// to the currently active tab
		if (direction === -1 || phase === Visible) {
			next = { ...session, navigatingRecents: true };

				// record any pending tab activation first, so the recents the
				// page shows are up to date before it starts navigating
			effects.push({ effect: "flushAddTab" });

			const selection = ["modifySelected", { direction: -direction, navigatingRecents: true }];

			switch (phase) {
				case Closed:
						// the page detects that it's being opened to navigate
						// recents and changes the selection itself
					next.phase = Creating;
					effects.push(create(false, true));
					break;

				case Creating:
					next.pending = selection;
					break;

				default:
					effects.push(notify(...selection));
			}
		}
	} else if (direction === -1 || !iconNormal) {
			// only invert the icon and start navigating if the user is going
			// backwards, or is going forwards before the cooldown ends
		effects.push({ effect: "navigateRecents", direction });
	}

		// this will record an event if the user hits alt-S when they're not
		// currently navigating, but probably not worth worrying about
	effects.push({
		effect: "track",
		action: direction === -1 ? "previous" : "next",
		label: iconNormal ? "single" : "repeated",
	});

	return [next, effects];
}


export function transition(
	session,
	event)
{
	const { phase, navigatingRecents } = session;

	switch (event.type) {
		case "open":
			return handleOpen(session, event);

		case "navigate":
			return handleNavigate(session, event);

		case "stopNavigating":
				// the toggle tells the page it's no longer navigating recents,
				// so that when the page gets blurred after the switch, it'll
				// close itself.  the page saying so itself needs no reply.
			return [
				{ ...session, navigatingRecents: false },
				(navigatingRecents && event.notify) ? [notify("stopNavigatingRecents")] : [],
			];

		case "pageReady": {
				// a page reporting ready means a popup exists and is showing,
				// whatever this context thought, so this also recovers from a
				// close that was seen late, during a reopen
			const effects = session.pending ? [notify(...session.pending)] : [];

			return [{ ...session, phase: Visible, pending: null }, effects];
		}

		case "created":
				// the window's own create event.  it also fires when a tab
				// stashed in another window is moved into a fresh popup window
				// to show it, which isn't a new page.
			return [phase === Closed ? { ...session, phase: Creating } : session, []];

		case "createAborted":
			return [phase === Creating ? { ...session, phase: Closed } : session, []];

		case "shown":
			return [{ ...session, phase: Visible }, []];

		case "hidden":
				// the popup getting hidden or closed while the user is
				// navigating recents by some mechanism other than releasing the
				// modifier ends the navigation
			return [
				{ ...session, phase: phase === Closed ? Closed : Hidden, navigatingRecents: false },
				[],
			];

		case "blurred":
			return [{ ...session, phase: phase === Closed ? Closed : Hidden }, []];

		case "closed":
			return [createSession(), []];
	}

	return [session, []];
}


	// one short word for a log line
export function describeSession(
	{ phase, navigatingRecents, pending })
{
	return phase
		+ (navigatingRecents ? "+navigating" : "")
		+ (pending ? `+pending(${pending[0]})` : "");
}
