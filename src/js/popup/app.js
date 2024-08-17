import React from "react";
import SearchBox from "./search-box";
import ResultsList from "./results-list";
import ResultsListItem from "./results-list-item";
import MessageItem from "./message-item";
import OptionsButton from "./options-button";
import { connectPopupWindow } from "./popup-window";
import scoreItems from "./score/score-items";
import initTabs from "./data/init-tabs";
import getBookmarks from "./data/get-bookmarks";
import getHistory from "./data/get-history";
import addURLs from "./data/add-urls";
import { loadPinyin } from "./data/add-pinyin";
import shortcuts from "./shortcuts/popup-shortcuts";
import handleRef from "@/lib/handle-ref";
import copyTextToClipboard from "@/lib/copy-to-clipboard";
import recentTabs from "@/background/recent-tabs";
import storage from "@/background/quickey-storage";
import settings from "@/background/settings";
import { debounce } from "@/background/debounce";
import * as k from "@/background/constants";
import _ from "lodash";


const MinScore = .04;
const NearlyZeroScore = .02;
const MaxItems = 10;
const MinItems = 4;
const MinScoreDiff = .1;
const BookmarksQuery = "/b ";
const HistoryQuery = "/h ";
const CommandQueryPattern = /^\/[bh]?$/i;
const NoRecentTabsMessage = [{
	message: "Recently used tabs will appear here as you continue browsing",
	faviconURL: "img/alert.svg",
	component: MessageItem
}];
const NoRecentTabsInWindowMessage = [{
	message: "There are no other recently used tabs in this window",
	faviconURL: "img/default-favicon.svg",
	component: MessageItem
}];
const DeleteBookmarkConfirmation = "Are you sure you want to permanently delete this bookmark?";
const SpacePattern = /\s+/;
const {
	OpenMenuCommand,
	OpenPopupCommand,
	FocusPopupCommand,
	PreviousTabCommand,
	NextTabCommand
} = k.CommandIDs;


let popupWindow;


function sortRecents(
	a,
	b)
{
		// sort open tabs before closed ones, and newer before old
	if ((a.sessionId && b.sessionId) || (!a.sessionId && !b.sessionId)) {
		return b.lastVisit - a.lastVisit;
	} else if (a.sessionId) {
		return 1;
	} else {
		return -1;
	}
}


function sortHistoryItems(
	a,
	b)
{
		// we want a decreasing sort order, so newer items come first
	return b.lastVisitTime - a.lastVisitTime;
}


function notEqual(
	a,
	b)
{
	const diff = Math.abs(a - b);

		// because of rounding issues in Chrome when the UI is not scaled to a
		// whole number, we want to ignore differences <= 6 in that case.  even
		// in normal situations, ignore small differences to avoid extraneous
		// shifts in the window size.
	return Number.isInteger(devicePixelRatio)
		? diff > 2
		: diff > 6;
}


export default class App extends React.Component {
	visible = false;
	mode = "tabs";
	tabsPromise = null;
	bookmarksPromise = null;
	historyPromise = null;
	forceUpdate = false;
	selectAllSearchBoxText = false;
	openedForSearch = false;
	ignoreNextBlur = false;
	ignoreNextResize = false;
	navigatingRecents = false;
	gotModifierUp = false;
	gotMRUKey = false;
	mruModifier = "Alt";
	resultsList = null;
	searchBox = null;
	settings = null;
	settingsPromise = null;
	className = "";
	popupTabID = -1;
	popupW = 0;
	popupH = 0;
	nextFrameRequestID = 0;
	port = null;


	constructor(props, context)
	{
		super(props, context);

		const query = props.initialQuery;

		this.openedForSearch = props.focusSearch;
		this.navigatingRecents = props.navigatingRecents;
		this.tabs = [];
		this.bookmarks = [];
		this.history = [];
		this.recents = [];
			// this array is always empty, and is only used by getMatchingItems()
			// when a / is typed and the mode is "command"
		this.command = [];
		this.settings = settings.getDefaults();
		this.settingsPromise = this.updateSettings();
			// we're saving the initial value of this prop instead of
			// getting it every time in render, which is normally bad, but
			// the platform will never change during the life of the app
		this.className = this.props.platform + (k.IsFirefox ? " firefox" : "");

		if (props.isPopup) {
				// in showWindow() we set gotMRUKey based on whether the popup
				// is being opened for search as well, but showWindow() isn't
				// called in the flow when the popup is opened the first time.
				// we only set this in the popup case, so if the user is
				// opening the menu with the last search restored, releasing
				// the MRU key from the shortcut won't automatically switch
				// to the first result.
			this.gotMRUKey = !this.openedForSearch;
			this.getActiveTab(true)
				.then((activeTab) => this.popupTabID = activeTab?.id);

				// create a messaging channel API for the popupWindow object in
				// the background script.  we only need this in the popup state.
			popupWindow = connectPopupWindow();
		}

		this.state = {
			query,
			searchBoxText: query,
			matchingItems: [],
				// default to the first item being selected if we got an
				// initial query or if the popup was opened in nav mode
			selected: (query || !this.openedForSearch || this.navigatingRecents) ? 0 : -1,
			newSettingsAvailable: false
		};
	}


	componentDidMount()
	{
		this.loadTabs()
			.then(tabs => {
					// by the time we get here, the settings promise will
					// already have resolved and updated this.settings, so
					// this will look for the correct MRU key
				const shiftMRUKey = this.settings.shortcuts[k.Shortcuts.MRUSelect];
				const mruKey = shiftMRUKey.toLocaleLowerCase();

					// after the recent tabs have been loaded and scored,
					// apply any shortcuts that were recorded during init
				this.props.initialShortcuts.forEach(shortcut => {
					if (shortcut == mruKey) {
						this.modifySelected(1, true);
					} else if (shortcut == shiftMRUKey) {
						this.modifySelected(-1, true);
					}
				});

				this.props.tracker.set("tabCount", tabs.length);

				if (this.navigatingRecents) {
						// since the popup has just been opened and we're navigating
						// recents, simulate getting a message from the background
						// telling us to move the selection to the next tab and
						// focus it, since the timing on getting a real message
						// from the background after opening is tricky
					return this.onMessage({
						message: "modifySelected",
						navigatingRecents: true,
						direction: 1
					});
				}
			});

		if (this.props.isPopup) {
				// we're being opened in a popup window, so add the event
				// handlers that are only needed in that case
			this.popupW = outerWidth;
			this.popupH = outerHeight;
			window.addEventListener("resize", this.onWindowResize);

				// hide the window if it loses focus
			window.addEventListener("blur", this.onWindowBlur);

// TODO: sometimes the resolution change doesn't get noticed and we don't resize the popup correctly

				// listen for resolution changes so we can resize the popup, in
				// case it changes based on the new DPI
			matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener("change", event => {
				if (!event.matches) {
					popupWindow.resize(this.popupW, this.popupH);
				}
			})
		}

		window.addEventListener("unload", () => {
				// if the restore last query option is off, clear any
				// existing stored query
			const lastQuery = this.settings[k.RestoreLastQuery.Key]
				? this.state.searchBoxText
				: "";

			storage.set(() => ({ lastQuery }));
		});

		this.visible = true;
		this.port = this.props.port;
		this.port.onMessage.addListener(this.onMessage);

		chrome.runtime.onConnect.addListener((port) => {
			if (port.name === "popup") {
				this.port.onMessage.removeListener(this.onMessage);
				this.port = port;
				this.port.onMessage.addListener(this.onMessage);
			}
		});

			// annoyingly, there seems to be a bug in Chrome where the
			// closed tab is still around when the callback passed to
			// chrome.tabs.remove() is called.  so we need to add an
			// onRemoved handler to listen for the actual removal.  this
			// also handles the edge case where the menu is open and a tab
			// in another window is closed.
		chrome.tabs.onRemoved.addListener(this.onTabRemoved);
	}


	componentDidUpdate()
	{
			// we only want these flags to be true through one render cycle
		this.forceUpdate = false;
		this.selectAllSearchBoxText = false;

			// when the number of matched items is < MaxItems, shrink the window
			// height, but only in the popup case, since the toolbar menu does
			// this automatically.  and only if the current mode's promise is
			// loaded, so that the window doesn't flicker while loading items.
		if (this.props.isPopup && this[this.mode].length) {
				// since we want to measure the body and window heights only after
				// the browser paints, do the check in a requestAnimationFrame.
				// cancel any pending requests first, since we sometimes get
				// multiple React updates in one frame.
			cancelAnimationFrame(this.nextFrameRequestID);
			this.nextFrameRequestID = requestAnimationFrame(() => {
				const bodyHeight = document.body.offsetHeight;
				const windowPadding = outerHeight - innerHeight;
// TODO: if the window is already small, the outerHeight could be smaller than innerHeight

				if (notEqual(innerHeight, bodyHeight)) {
						// don't fight with the onResize handler, and use the Chrome
						// API to resize the popup, since it can make the window
						// shorter than window.resizeTo() can.  pass the saved
						// outerWidth in this.popupW, in case the actual outerWidth
						// has changed for some reason.
					this.ignoreNextResize = true;
					this.popupH = bodyHeight + windowPadding;
					popupWindow.resize(this.popupW, this.popupH);
				}
			});
		}
	}


	loadPromisedItems(
		loader,
		itemName,
		reload = false)
	{
		const promiseName = itemName + "Promise";

		if (!this[promiseName] || reload) {
				// store the promise so we only load the items once
			this[promiseName] = loader().then(items => {
					// score the items so the expected keys are added
					// to each one, and then update the results list with
					// matches on the current query
				this[itemName] = scoreItems(items, []);
				this.setQuery(this.state.query);

				return items;
			});
		}

		return this[promiseName];
	}


	loadTabs()
	{
		const loader = async () => {
			const settings = await this.settingsPromise;
				// even if we're navigating recents and pass null below, we
				// still need the activeTab to get the currentWindowID
			const activeTab = await this.getActiveTab();
			const tabs = await initTabs(
					// don't include recently closed tabs when navigating
					// recents, since you can't navigate to them
				recentTabs.getAll(!this.navigatingRecents &&
					settings[k.IncludeClosedTabs.Key]),
					// when we're navigating recents, we want to include the
					// current tab in the list in the popup window, so pass
					// null so initTabs() doesn't filter it out
				this.navigatingRecents ? null : activeTab,
				settings[k.MarkTabsInOtherWindows.Key],
				settings[k.UsePinyin.Key]
			);
			const currentWindowID = activeTab && activeTab.windowId;
				// this promise chain starts with settingsPromise, so by
				// the time we're, that's already resolved and has set
				// this.settings.  an ugly side effect, but easier than
				// passing the settings along down the chain.
			const recentsFilter = this.settings[k.CurrentWindowLimitRecents.Key]
				? ({lastVisit, windowId}) => lastVisit && windowId === currentWindowID
				: ({lastVisit, windowId}) => lastVisit;

				// include only recent and closed tabs that have a last
				// visit time.  this may also filter out tabs that aren't
				// in the current window, depending on that setting.
			this.recents = tabs
				.filter(recentsFilter)
				.sort(sortRecents)

			if (!this.recents.length) {
				this.recents = this.settings[k.CurrentWindowLimitRecents.Key]
					? NoRecentTabsInWindowMessage
					: NoRecentTabsMessage;
			}

			if (this.settings[k.CurrentWindowLimitSearch.Key]) {
					// limit the tabs list to those in the current
					// window.  since the limit search option is linked
					// to limit recents, we know the recents are a subset
					// of the filtered searchable list, so when
					// loadPromisedItems() calls scoreItems() after this
					// promise chain is done, the recent tabs are
					// guaranteed to receive all the scoring keys, like
					// score, scores, etc.
				return tabs.filter(
					({windowId}) => windowId === currentWindowID);
			} else {
				return tabs;
			}
		};

			// pass true to always force a reload
		return this.loadPromisedItems(loader, "tabs", true);
	};


	setSearchBoxText(
		searchBoxText)
	{
		const showBookmarkPaths = this.settings[k.ShowBookmarkPaths.Key];
		const usePinyin = this.settings[k.UsePinyin.Key];
		const searchBoxTextLC = searchBoxText.toLowerCase();
		let query = searchBoxText;

		if (searchBoxTextLC.indexOf(BookmarksQuery) == 0) {
			this.mode = "bookmarks";
			query = searchBoxText.slice(BookmarksQuery.length);

			if (!this.bookmarks.length) {
					// we haven't fetched the bookmarks yet, so load them
					// and then call getMatchingItems() after they're ready
				this.loadPromisedItems(
					() => getBookmarks(showBookmarkPaths, usePinyin),
					"bookmarks"
				);
			}
		} else if (searchBoxTextLC.indexOf(HistoryQuery) == 0) {
			this.mode = "history";
			query = searchBoxText.slice(HistoryQuery.length);

			if (!this.history.length) {
				this.loadPromisedItems(
					() => getHistory(usePinyin),
					"history"
				);
			}
		} else if (CommandQueryPattern.test(searchBoxText)) {
				// we don't know if the user's going to type b or h, so
				// don't match any items
			this.mode = "command";
			query = "";
		} else {
			this.mode = "tabs";
		}

		this.setState({ searchBoxText });
		this.setQuery(query);
	};


	setQuery(
		query)
	{
		this.setState({
			query,
			matchingItems: this.getMatchingItems(query),
			selected: (query || (this.props.isPopup && (!this.openedForSearch || this.navigatingRecents)))
				? 0
				: -1
		});
	}


	async clearQuery()
	{
		let {searchBoxText} = this.state;

		if (!searchBoxText || this.settings[k.EscBehavior.Key] == k.EscBehavior.Close) {
				// pressing esc in an empty field should close the popup, or
				// if the user checked the always close option
			this.closeWindow(true, await this.getActiveTab());
		} else {
			const searchBoxTextLC = searchBoxText.toLowerCase();

				// if we're searching for bookmarks or history, reset the
				// query to just /b or /h, rather than clearing it, unless
				// it's already a command, in which case, clear it
			if (
				this.mode == "tabs" ||
				this.mode == "command" ||
				searchBoxTextLC == BookmarksQuery ||
				searchBoxTextLC == HistoryQuery
			) {
				searchBoxText = "";
			} else if (this.mode == "bookmarks") {
				searchBoxText = BookmarksQuery;
			} else if (this.mode == "history") {
				searchBoxText = HistoryQuery;
			}

				// scroll the list back to the first row, which wouldn't
				// happen by default if we just cleared the query, since in
				// that case there's no selected item to scroll to.  we need
				// to set forceUpdate so the input updates.
			this.forceUpdate = true;
			this.resultsList.scrollToRow(0);
			this.setSearchBoxText(searchBoxText);
		}
	}


	getMatchingItems(
		query)
	{
			// trim any trailing space so that if the user typed one
			// word and then hit space, we'll turn that into just one
			// token, instead of the word plus an empty token
		const tokens = query.trim().split(SpacePattern);
			// score the items before checking the query, in case there had
			// been a previous query, leaving hitMasks on all the items.
			// if the query is now empty, we need to clear the hitMasks from
			// all the items before returning so no chars are shown matching.
		const items = scoreItems(this[this.mode], tokens, this.settings[k.UsePinyin.Key]);

		if (!query) {
			switch (this.mode) {
				case "tabs":
						// this array is pointing at the same objects that
						// are in this.tabs, so their hitMasks will have
						// been cleared when we get here
					return this.recents;

				case "history":
						// special case the /h query so that we can sort the
						// history items by visit date and show them as soon
						// as the command is typed with no query
					return this.history.sort(sortHistoryItems);

				default:
						// return bookmarks sorted alphabetically.  for the
						// command mode, items is an empty array.
					return items;
			}
		}

			// adjust these min values based on the number of tokens, since each
			// item's score is based on the total from each token
		const minScore = MinScore * tokens.length;
		const minScoreDiff = MinScoreDiff * tokens.length;
		const nearlyZeroScore = NearlyZeroScore * tokens.length;
		const firstScoresDiff = (items.length > 1 && items[0].score > minScore)
			? items[0].score - items[1].score
			: 0;
			// drop barely-matching results, keeping a minimum of 3,
			// unless there's a big difference in scores between the
			// first two items, which may mean we need a longer tail
		const matchingItems = _.dropRightWhile(items, ({score}, i) =>
			score < nearlyZeroScore ||
				(score < minScore && (i + 1 > MinItems || firstScoresDiff > minScoreDiff))
		);

		return matchingItems;
	}


	openItem = async (
		item,
		shiftKey,
		modKey) =>
	{
			// check for a URL on the selected item, so we can ignore the special
			// items that just show a message
		if (item && item.url) {
			const {url} = item;
			let tabOrWindow;

				// blur the popup so that it goes behind the active tab
				// before we focus a different tab below.  that way, the new
				// active tab and the previous one will be the top two items
				// in the window MRU list, and the user can alt-tab between
				// them, instead of the popup being second on the list.
			await this.blurPopupWindow();

			if (this.mode == "tabs") {
				if (item.sessionId) {
						// this is a closed tab, so restore it
					tabOrWindow = await this.sendMessage("restoreSession",
						{ sessionID: item.sessionId });
					this.props.tracker.event("tabs", "restore");
				} else {
						// switch to the tab.  pass navigatingRecents so that if
						// we're currently doing that it'll pass true to
						// focusTab(), which will then cause the handler in the
						// background to set that flag to false before focusing
						// the tab.  this is needed so that the tab activation
						// will get tracked when the popup was opened to navigate
						// recents, but then the user clicked an item, or hit
						// enter to select the current one.
					tabOrWindow = await this.focusTab(item, shiftKey, this.navigatingRecents);
				}
			} else if (shiftKey) {
					// open in a new window
				tabOrWindow = await this.sendMessage("createWindow", { url });
				this.props.tracker.event(this.mode, "open-new-win");
			} else if (modKey) {
					// open in a new tab
				tabOrWindow = await this.sendMessage("createTab", { url });
				this.props.tracker.event(this.mode, "open-new-tab");
			} else {
					// open in the active tab, which, in the case of a popup,
					// is not in the current window (since that's the popup)
				const {id} = await this.getActiveTab();

				tabOrWindow = await this.sendMessage("setURL", { tabID: id, url });
				this.props.tracker.event(this.mode, "open");
			}

			await this.closeWindow(false, tabOrWindow);
		}
	};


	async focusTab (
		tab,
		unsuspend,
		stopNavigatingRecents)
	{
			// check for a URL on the selected item, so we can ignore the special
			// items that just show a message
		if (tab && tab.url) {
			const queryLength = this.state.query.length;
			const category = queryLength ? "tabs" : "recents";
			let event = (category == "recents" && this.gotMRUKey)
				? "focus-mru"
				: "focus";
			let options;

			if (unsuspend && tab.unsuspendURL) {
					// change to the unsuspended URL
				options = { url: tab.unsuspendURL };
				event = "unsuspend";
			}

			this.props.tracker.event(category, event,
				queryLength ? queryLength : this.state.selected);

			return this.sendMessage("focusTab", { tab, options, stopNavigatingRecents });
		} else {
			return null;
		}
	}


		// although this method also deletes bookmarks/history items, keep
		// the closeTab name since that's the name of the shortcut setting
	closeTab = (
		item) =>
	{
		const {query} = this.state;
		const {mode} = this;


		const deleteItem = (
			deleteFunc,
			eventCategory = mode) =>
		{
			deleteFunc(item);
			_.pull(this[mode], item);

				// call getMatchingItems() to get the updated results list
				// minus the item we removed.  limit the selected index to
				// the new matching items length, in case the user deleted
				// the very last item.
			const matchingItems = this.getMatchingItems(query);
			const selected = Math.min(this.state.selected, matchingItems.length - 1);

			this.setState({ selected, matchingItems });
			this.props.tracker.event(eventCategory, "close");
		};


		if (item) {
			if (mode == "tabs") {
				if (!isNaN(item.id)) {
						// the onTabRemoved handler below will re-init the
						// list, which will then show the tab as closed
					chrome.tabs.remove(item.id);
					this.props.tracker.event(query ? "tabs" : "recents", "close");
				} else {
						// this is a closed tab that the user wants to
						// delete, so pass a special event category
					deleteItem(({url}) => {
							// deleting the URL from history also deletes
							// any session for that URL
						chrome.history.deleteUrl({ url });

							// since this closed tab is also in the recents
							// list, we have to pull it from there as well.
							// do it in this callback so that it's removed
							// before getMatchingItems() is called.  we
							// don't need to do that in the tab branch above
							// because the onTabRemoved handler calls
							// loadTabs(), which re-inits recents.
						_.pull(this.recents, item);
					}, "closed-tab");
				}
			} else if (mode == "bookmarks") {
				if (confirm(DeleteBookmarkConfirmation)) {
					deleteItem(({id}) => chrome.bookmarks.remove(id));
				}
			} else if (mode == "history") {
				const url = item.originalURL;

					// we have to use originalURL to delete the history item,
					// since it may have been a suspended page and we convert
					// url to the unsuspended version
				deleteItem(() => chrome.history.deleteUrl({ url }));

					// just in case this URL was also recently closed, remove
					// it from the tabs and recents lists, since it will no
					// longer be re-openable
				_.remove(this.tabs, { url });
				_.remove(this.recents, { url });
			}
		}
	};


	moveTab(
		tab,
		direction,
		unsuspend)
	{
			// get the current active tab, in case the user had closed the
			// previously active tab
		this.getActiveTab()
			.then(activeTab => {
					// if the active tab is at 0, and we want to move
					// another tab to the left of it, force that index
					// to be 0, which shifts the active tab to index: 1
				let index = Math.max(0, activeTab.index + direction);

				if (tab.windowId == activeTab.windowId) {
					if (index == tab.index) {
							// the tab's already where the user is trying to
							// move it, so do nothing
						return;
					} else if ((tab.index < activeTab.index && direction > 0) ||
							(tab.index > activeTab.index && direction < 0)) {
							// the moved tab is in the same window and is to
							// the left of the active one and the user wants
							// to move it to the right, or the tab is to the
							// right and they want to move it to the the
							// left, so just set index to the active tab's
							// position, since removing the moved tab will
							// shift the active one's index to the left
							// before the moved one is re-inserted
						index = activeTab.index;
					}
				} else if (direction < 0) {
						// the user wants to move a tab from another window
						// to the active tab's left, so use its index, which
						// will shift it to the right of the moved tab
					index = activeTab.index;
				}

				return chrome.tabs.move(tab.id, {
					windowId: activeTab.windowId,
					index: index
				});
			})
			.then(movedTab => {
				if (Array.isArray(movedTab)) {
						// annoyingly, this is returned as an array in FF
					movedTab = movedTab[0];
				}

					// use the movedTab from this callback, since
					// the tab reference we had to it from before is
					// likely stale.  we also have to call addURLs()
					// on this new tab reference so it gets the
					// unsuspendURL added to it if necessary, so that
					// unsuspending it will work.
				addURLs(movedTab);
				this.focusTab(movedTab, unsuspend);
				this.props.tracker.event(this.state.query.length ? "tabs" : "recents",
					"move-" + (direction ? "right" : "left"));

					// focusing the tab doesn't close the menu in FF, so
					// close it explicitly just in case
				this.closeWindow();

// TODO: this is only needed if we don't focus the tab after moving it
//					return this.loadTabs()
//						.then(() => this.setState({ selected }));
			});
	}


	copyItemURL(
		item,
		includeTitle)
	{
		if (item) {
			const text = (includeTitle ? item.title + "\n" : "") +
				(item.unsuspendURL || item.url);

			copyTextToClipboard(text);
		}
	}


	modifySelected(
		delta,
		mruKey)
	{
		const index = this.state.selected + delta;

		return this.setSelectedIndex(index, mruKey);
	}


	setSelectedIndex = (
		index,
		mruKey) =>
	{
			// return the new selected state in a promise, so the caller can
			// await the state change and re-render
		return new Promise(resolve => {
				// get the current state before calculating the index so we have
				// the latest items count
			this.setState(({matchingItems: {length}}) => {
				if (mruKey) {
						// let the selected value go to -1 when using the MRU key to
						// navigate up, and don't wrap at the end of the list
					index = Math.min(Math.max(-1, index), length - 1);
					this.gotModifierUp = false;
					this.gotMRUKey = true;
				} else {
						// wrap around the end or beginning of the list
					index = (index + length) % length;
				}

				return { selected: index };
			}, () => resolve(this.state.selected));
		});
	};


	getActiveTab(
		blurred = false)
	{
		if (!this.props.isPopup || blurred) {
				// currentWindow used to work with manifest V2, but now that
				// returns the popup when the user manually focuses another
				// window.  lastFocusedWindow returns the correct window.
			return chrome.tabs.query({ active: true, lastFocusedWindow: true })
				.then(([activeTab]) => activeTab);
		} else {
				// since we're in a popup, get the active tab from the
				// background, which recorded it before opening this window
			return this.sendMessage("getActiveTab");
		}
	}


	async updateSettings()
	{
		const data = await storage.get();

		this.setState({
			newSettingsAvailable: data.lastSeenOptionsVersion < storage.version
		});

			// don't restore the query if the user is navigating recents
			// with the popup open
		if (!this.navigatingRecents && data.settings[k.RestoreLastQuery.Key]
				&& data.lastQuery) {
				// we need to force the input to update to the stored
				// text, and then force it to select all
			this.forceUpdate = true;
			this.selectAllSearchBoxText = true;
			this.setSearchBoxText(data.lastQuery);
		} else {
			this.setSearchBoxText("");
		}

			// pass the data we got from storage to settings so it
			// doesn't have to get its own copy of it
		this.settings = await settings.get(data);
		shortcuts.update(this.settings);

			// update the modifier event name based on the latest settings, in
			// case the keyboard shortcut has been changed
		this.updateMRUModifier();

		if (this.settings.usePinyin) {
				// searching by pinyin is enabled, so load the lib now, so
				// that it's available by the time we init all the tabs and
				// add the pinyin translations
			await loadPinyin();
		}

		return this.settings;
	}


	updateMRUModifier(
		direction)
	{
		let commandID;

		if (!this.props.isPopup) {
			commandID = OpenMenuCommand;
		} else if (this.navigatingRecents) {
			commandID = (direction === 1)
				? NextTabCommand
				: PreviousTabCommand;
		} else {
			commandID = this.openedForSearch
				? FocusPopupCommand
				: OpenPopupCommand;
		}

		this.mruModifier = this.settings.chrome.shortcutsByID[commandID]?.modifierEventName;
	}


	async showWindow({
		focusSearch,
		activeTab})
	{
			// set visible before calling loadTabs(), since that will call
			// getActiveTab(), which checks visible
		this.visible = true;
		this.ignoreNextBlur = false;

			// set our flag to the latest value so that the correct item is
			// selected after tabs are loaded
		this.openedForSearch = focusSearch;

			// regardless of whether the first item is selected or not, set
			// the focus to the searchbox, in case the last time the window
			// was open the user had clicked somewhere else.  without this,
			// the focus would still be on that other element.
		this.searchBox.focus();

			// set these so that when the modifier key is released (it had
			// to have been pressed for showWindow() to be called), it
			// activates the selected item, but only if the popup isn't
			// being opened with search focused.  in that case, we don't
			// want the modifier up event to do anything, even if the
			// previous query is restored, and therefore the first item in
			// the list is selected.
		this.gotModifierUp = false;
		this.gotMRUKey = !focusSearch;

			// get the latest settings, in case they've changed, so that
			// they'll be available in loadTabs()
		this.settingsPromise = await this.updateSettings();

			// the tab list should already be correct in most cases, but
			// load them again just to make sure
		return this.loadTabs()
			.then(() => this.showPopupWindow(activeTab));
	}


	closeWindow(
		closedByEsc,
		focusedTabOrWindow)
	{
		this.ignoreNextBlur = true;

		if (closedByEsc) {
				// send this message regardless of menu or popup mode
			this.port.postMessage("closedByEsc");
		}

		if (!this.props.isPopup) {
				// we seem to have to close the window in a timeout so that
				// the hover state of the browser action button gets cleared
			setTimeout(window.close, 0);
		} else {
			if (this.settings[k.RestoreLastQuery.Key]) {
					// save the current query so updateSettings() will
					// restore it when the popup is reopened, but not if the
					// user is navigating recents, so that the empty search
					// box doesn't overwrite the saved query.  we have to
					// check this before setting it to false below.
				if (!this.navigatingRecents) {
					storage.set(() => ({ lastQuery: this.state.searchBoxText }));
				}
			} else {
					// the restore last query option is off, so clear any
					// existing stored query
				this.setSearchBoxText("");
				storage.set(() => ({ lastQuery: "" }));
			}

			this.forceUpdate = true;
			this.resultsList.scrollToRow(0);
			this.visible = false;
			this.navigatingRecents = false;

				// clear any bookmarks or history we might have loaded while
				// the window was open, since they may be different the next
				// time the user accesses them.  this way we won't show
				// stale data.
			this.bookmarks = [];
			this.bookmarksPromise = null;
			this.history = [];
			this.historyPromise = null;

				// if we're being closed by esc, not by losing focus or by
				// focusing another tab, then in addition to moving off
				// screen, force the popup to lose focus so some other
				// window comes forward
			return popupWindow.hide(closedByEsc, focusedTabOrWindow);
		}
	}


	reopenWindow()
	{
			// ignore the blur event triggered by closing the popup
		this.ignoreNextBlur = true;
		this.sendMessage("reopenPopup", { focusSearch: this.openedForSearch }, false);
	}


	showPopupWindow(
		activeTab)
	{
		return popupWindow.show(activeTab, activeTab ? "center-center" : "right-center");
	}


	async blurPopupWindow()
	{
		if (this.props.isPopup
				&& this.settings[k.HidePopupBehavior.Key] !== k.HidePopupBehavior.Minimize) {
				// set this so that when we blur the popup next, the
				// blur handler won't do anything.  we blur it so that
				// it goes behind the active tab before we focus a
				// different tab below.  that way, the new active tab
				// and the previous one will be the top two items in
				// the window MRU list, and the user can alt-tab between
				// them, instead of the popup being second on the list.
			this.ignoreNextBlur = true;
			await popupWindow.blur();
		}
	}


	sendMessage(
		message,
		payload = {},
		awaitResponse = true)
	{
		const messageBody = { message, ...payload };

		if (awaitResponse) {
				// we can't use chrome.runtime.sendMessage() because it's a
				// shared instance that's on the background page, so calling
				// sendMessage() from there would be going from the
				// background to this window, but we want the opposite
			return new Promise(resolve =>
				chrome.runtime.sendMessage(messageBody, resolve));
		} else {
				// no response is required, so don't send a callback.
				// otherwise, we'll get runtime errors about the port closing.
			return chrome.runtime.sendMessage(messageBody);
		}
	}


	handleListRef = handleRef("resultsList", this);


	handleSearchBoxRef = handleRef("searchBox", this);


	onTabRemoved = (
		tabID) =>
	{
		const {selected} = this.state;

			// if we're getting called because the popup itself is being
			// closed, ignore the event, since there's no reason to load tabs
		if (tabID !== this.popupTabID) {
				// refresh the results list so that the newly closed tab
				// will show in the closed list, and if there are multiple
				// tabs with the same name, their index numbers will update.
				// loadTabs() calls loadPromisedItems(), which calls
				// setQuery(), which will reset the selected index to 0.  so
				// after the tabs are reloaded, set selected back to what it
				// was, limiting it to the current items length, in case the
				// user had closed the very last item in the list.
			this.loadTabs()
				.then(() => this.setState(({matchingItems}) =>
					({ selected: Math.min(selected, matchingItems.length - 1) })));
		}
	};


	onQueryChange = (
		event) =>
	{
		this.setSearchBoxText(event.target.value);
	};


	onKeyDown = (
		event) =>
	{
			// reset this on every keyDown so we know if the user had typed
			// an alt-W or alt-shift-W before releasing alt.  it will get set
			// to true in setSelectedIndex().
		this.gotMRUKey = false;

			// keydown handling is managed in another module
		return shortcuts.handleEvent(event, this);
	};


	onKeyUp = async (
		event) =>
	{
		if (event.key == this.mruModifier) {
			if (!this.gotModifierUp && this.gotMRUKey && this.state.selected > -1) {
				const selectedItem = this.state.matchingItems[this.state.selected];

				if (this.navigatingRecents) {
						// the user has stopped navigating through recents,
						// so tell the background to change its state so that
						// when the popup closes, the current tab's activation
						// will be detected
					this.sendMessage("stopNavigatingRecents", undefined, false);

						// pass true for closedByEsc so that the background
						// doesn't interpret a quick open and close as a
						// toggle recents action.  closeWindow also sets
						// navigatingRecents to false.
					await this.closeWindow(true, selectedItem);

						// tell the background to add the newly focused tab
						// to recents immediately so the user could quickly
						// switch to another tab while keeping recents correct
					this.sendMessage("executeAddTab", undefined, false);
				} else {
					await this.openItem(selectedItem);
				}
			}

			this.gotModifierUp = true;
			this.gotMRUKey = false;
		}
	};


	onOptionsClick = async () =>
	{
		const url = chrome.runtime.getURL("options.html");
		const [tab] = await chrome.tabs.query({ url });
		let optionsTab;

		this.searchBox.focus();

		if (tab) {
			optionsTab = await this.sendMessage("focusTab", { tab });
		} else {
			optionsTab = await this.sendMessage("createTab", { url });
		}

			// force the popup to close, since focusing or opening the
			// options tab doesn't seem to blur the popup, leaving it open.
			// pass true on Mac to make sure the popup hides behind
			// something, since creating a new options tab doesn't seem to
			// blur the popup.
		this.closeWindow(k.IsMac, optionsTab);
		this.props.tracker.event("extension", "open-options");
	};


	onMessage = async ({
		message,
		...payload}) =>
	{
		switch (message) {
			case "modifySelected":
				const {navigatingRecents, direction} = payload;

				if (navigatingRecents) {
					this.navigatingRecents = true;

					if (!this.visible) {
							// show the window first, since that resets the
							// selected state to -1
						await this.showWindow({ focusSearch: false, activeTab: null });


							// set selected based on the direction so that
							// when modifySelected() is called below, the
							// direction delta will end up selecting the
							// correct item: 0 for switch to next, 1 for
							// switch to previous.  item 0 will be the
							// current tab if we're opening the popup for
							// the first time during a navigation flow.
						await this.setSelectedIndex(direction == 1 ? 0 : 1, true);
					}

					this.updateMRUModifier(direction);

					const index = await this.modifySelected(direction, true);

					await this.focusTab(this.state.matchingItems[index]);
					await this.showPopupWindow(null, "right-center");
				} else {
					this.updateMRUModifier();
					await this.modifySelected(direction, true);
				}
				break;

			case "tabActivated":
				if (!this.navigatingRecents) {
						// loadTabs() calls loadPromisedItems() with a forced
						// reload, so it'll trigger a render with the new items
					this.loadTabs();
				}
				break;

			case "showWindow":
				await this.showWindow(payload);
				break;

			case "stopNavigatingRecents":
				this.navigatingRecents = false;
				break;

			case "focusSearch":
				this.gotMRUKey = false;
				this.tabsPromise.then(() => this.setState({ selected: -1 }));
				break;
		}
	};


	onWindowBlur = async () =>
	{
		if (!this.ignoreNextBlur && !this.navigatingRecents) {
				// only call this if we're losing focus because the user
				// clicked another window, and not from pressing esc.  get
				// the active tab so it can get passed to popupWindow.hide(),
				// where it'll be the target window to hide the popup behind.
				// pass true to getActiveTab() so it ignores the fact that
				// the popup is still visible, since we want to query to get
				// the tab that was just focused, which we want to hide behind.
			this.closeWindow(false, await this.getActiveTab(true));
		}

		this.ignoreNextBlur = false;
	};


	onWindowResize = debounce(() => {
		if (innerWidth == outerWidth && k.IsWin) {
				// sometimes, something forces the popup to redraw in
				// a weird way, where the borders and window drop
				// shadow are lost.  seems like the only solution is
				// to close and reopen the window.  this happens only on
				// Windows.  on macOS, the inner and outer widths are
				// always the same.
			this.reopenWindow();
			warn("=== borders collapsed");
		} else if (!this.ignoreNextResize &&
				(notEqual(outerWidth, this.popupW) || notEqual(outerHeight, this.popupH))) {
				// prevent the window from resizing, but only if the width
				// or height have actually changed, since we sometimes
				// get resize events when the size is the same
			this.ignoreNextResize = true;
			popupWindow.resize(this.popupW, this.popupH);

			return;
		}

		this.ignoreNextResize = false;
	}, 250);


	render()
	{
		const {
			query,
			searchBoxText,
			matchingItems,
			selected,
			newSettingsAvailable
		} = this.state;

		return <div className={this.className}>
			<SearchBox
				autoFocus
				ref={this.handleSearchBoxRef}
				mode={this.mode}
				forceUpdate={this.forceUpdate}
				selectAll={this.selectAllSearchBoxText}
				query={searchBoxText}
				onChange={this.onQueryChange}
				onKeyDown={this.onKeyDown}
				onKeyUp={this.onKeyUp}
			/>
			<OptionsButton
				newSettingsAvailable={newSettingsAvailable}
				onClick={this.onOptionsClick}
			/>
			<ResultsList
				ref={this.handleListRef}
				items={matchingItems}
				maxItems={MaxItems}
				itemComponent={ResultsListItem}
				mode={this.mode}
				query={query}
				visible={this.visible}
				selectedIndex={selected}
				setSelectedIndex={this.setSelectedIndex}
				openItem={this.openItem}
				closeTab={this.closeTab}
			/>
		</div>
	}
}
