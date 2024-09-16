define("popup/app", [
	"react",
	"jsx!./search-box",
	"jsx!./results-list",
	"jsx!./results-list-item",
	"jsx!./message-item",
	"jsx!./options-button",
	"cp",
	"./score/score-items",
	"./data/init-tabs",
	"./data/get-bookmarks",
	"./data/get-history",
	"./data/add-urls",
	"./data/add-pinyin",
	"./shortcuts/popup-shortcuts",
	"lib/handle-ref",
	"lib/copy-to-clipboard",
	"background/popup-window",
	"background/recent-tabs",
	"background/quickey-storage",
	"background/settings",
	"background/constants",
	"lodash"
], function(
	React,
	SearchBox,
	ResultsList,
	ResultsListItem,
	MessageItem,
	OptionsButton,
	cp,
	scoreItems,
	initTabs,
	getBookmarks,
	getHistory,
	addURLs,
	{loadPinyin},
	shortcuts,
	handleRef,
	copyTextToClipboard,
	popupWindow,
	recentTabs,
	storage,
	settings,
	k,
	_
) {
	const MinScore = .04;
	const NearlyZeroScore = .02;
	const MaxItems = 10;
	const MinItems = 4;
	const MinScoreDiff = .1;
	const BookmarksQuery = "/b ";
	const HistoryQuery = "/h ";
	const CommandQueryPattern = /^\/[bh]?$/;
	const NoRecentTabsMessage = [{
		message: "Recently used tabs will appear here as you continue browsing",
		faviconURL: "img/alert.svg",
		component: MessageItem
	}];
	const DeleteBookmarkConfirmation = "Are you sure you want to permanently delete this bookmark?";


	function sortHistoryItems(
		a,
		b)
	{
		return b.lastVisitTime - a.lastVisitTime;
	}


	var App = React.createClass({
		visible: true,
		mode: "tabs",
		tabs: [],
		bookmarks: [],
		history: [],
		recents: [],
			// this array is always empty, and is only used by getMatchingItems()
			// when a / is typed and the mode is "command"
		command: [],
		tabsPromise: null,
		bookmarksPromise: null,
		historyPromise: null,
		forceUpdate: false,
		selectAllSearchBoxText: false,
		closeWindowCalled: false,
		openedForSearch: false,
		gotModifierUp: false,
		gotMRUKey: false,
		mruModifier: "Alt",
		resultsList: null,
		searchBox: null,
		settings: settings.getDefaults(),
		settingsPromise: null,


		getInitialState: function()
		{
			const query = this.props.initialQuery;

			this.settingsPromise = storage.get()
				.then(data => {
					if (data.lastSeenOptionsVersion < storage.version) {
							// new settings have been added since the last time
							// the user opened the options page
						this.setState({ newSettingsAvailable: true });
					}

					if (data.settings[k.RestoreLastQuery.Key] && data.lastQuery) {
							// we need to force the input to update to the stored
							// text, and then force it to select all
						this.forceUpdate = true;
						this.selectAllSearchBoxText = true;
						this.setSearchBoxText(data.lastQuery);
					}

						// pass the data we got from storage to settings so it
						// doesn't have to get its own copy of it
					return settings.get(data);
				})
				.then(this.updateSettings);

			this.openedForSearch = this.props.focusSearch;

			return {
				query,
				searchBoxText: query,
				matchingItems: [],
					// default to the first item being selected if we got an
					// initial query or if the popup was opened in nav mode
				selected: (query || !this.openedForSearch) ? 0 : -1,
				newSettingsAvailable: false
			};
		},


		componentWillMount: function()
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

					this.props.tracker.set("metric1", tabs.length);
				});
		},


		componentDidMount: function()
		{
			if (this.props.isPopup) {
					// we're being opened in a popup window, so add the event
					// handlers that are only needed in that case
				const {outerWidth, outerHeight} = window;

					// prevent the window from resizing
				window.addEventListener("resize",
					() => window.resizeTo(outerWidth, outerHeight));

					// hide the window if it loses focus
				window.addEventListener("blur", this.onWindowBlur);

					// listen for resolution changes so we can close the popup
					// and reset the sizing adjustments
				matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addListener(event => {
					if (!event.matches) {
							// close the window when the resolution changes, not
							// just hide it off-screen, so it then will get
							// recreated with the right size offsets
						popupWindow.close();
					}
				})
			}

			this.props.port.onMessage.addListener(this.onMessage);

				// annoyingly, there seems to be a bug in Chrome where the
				// closed tab is still around when the callback passed to
				// chrome.tabs.remove() is called.  so we need to add an
				// onRemoved handler to listen for the actual removal.  this
				// also handles the edge case where the menu is open and a tab
				// in another window is closed.
			chrome.tabs.onRemoved.addListener(this.onTabRemoved);

			window.addEventListener("unload", () => {
					// if the restore last query option is off, clear any
					// existing stored query
				const lastQuery = this.settings[k.RestoreLastQuery.Key]
					? this.state.searchBoxText
					: "";

				storage.set(() => ({ lastQuery }));
			});
		},


		componentDidUpdate: function()
		{
				// we only want these flags to be true through one render cycle
			this.forceUpdate = false;
			this.selectAllSearchBoxText = false;
		},


		loadPromisedItems: function(
			loader,
			itemName,
			reload = false)
		{
			const promiseName = itemName + "Promise";

			if (!this[promiseName] || reload) {
					// store the promise so we only load the items once
				this[promiseName] = loader().then(items => {
						// score the the items so the expected keys are added
						// to each one, and then update the results list with
						// matches on the current query
					this[itemName] = scoreItems(items, "");
					this.setQuery(this.state.query);

					return items;
				});
			}

			return this[promiseName];
		},


		loadTabs: function()
		{
			return this.loadPromisedItems(() => Promise.all([
					this.settingsPromise,
					this.getActiveTab()
				])
				.then(([settings, activeTab]) => initTabs(
					recentTabs.getAll(settings[k.IncludeClosedTabs.Key]),
					activeTab,
					settings[k.MarkTabsInOtherWindows.Key],
						// pass in the space key behavior so initTabs() knows
						// whether to normalize all whitespace, which is not
						// needed if space moves the selection
					settings[k.SpaceBehavior.Key] == k.SpaceBehavior.Space,
					settings[k.UsePinyin.Key]))
				.then(tabs => Promise.all([
					tabs,
					cp.tabs.query({
						active: true,
						currentWindow: true
					})
				]))
				.then(([tabs, [activeTab]]) => {
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
						.sort((a, b) => {
								// sort open tabs before closed ones, and newer
								// before old
							if ((a.sessionId && b.sessionId) || (!a.sessionId && !b.sessionId)) {
								return b.lastVisit - a.lastVisit;
							} else if (a.sessionId) {
								return 1;
							} else {
								return -1;
							}
						});

					if (!this.recents.length) {
						this.recents = NoRecentTabsMessage;
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
						return tabs.filter(({windowId}) => windowId === currentWindowID);
					} else {
						return tabs;
					}
				}), "tabs", true);	// pass true to force a reload
		},


		setSearchBoxText: function(
			searchBoxText)
		{
			const showBookmarkPaths = this.settings[k.ShowBookmarkPaths.Key];
			const usePinyin = this.settings[k.UsePinyin.Key];
			let query = searchBoxText;

			if (searchBoxText.indexOf(BookmarksQuery) == 0) {
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
			} else if (searchBoxText.indexOf(HistoryQuery) == 0) {
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
		},


		setQuery: function(
			query)
		{
log("setQuery", query)
			this.setState({
				query,
				matchingItems: this.getMatchingItems(query),
				selected: query  ? 0 : -1
//				selected: (query || this.props.isPopup) ? 0 : -1
			});
		},


		clearQuery: async function()
		{
			let {searchBoxText} = this.state;

			if (!searchBoxText || this.settings[k.EscBehavior.Key] == k.EscBehavior.Close) {
					// pressing esc in an empty field should close the popup, or
					// if the user checked the always close option
				this.props.port.postMessage("closedByEsc");
				await this.closeWindow(true, await this.getActiveTab());
			} else {
					// if we're searching for bookmarks or history, reset the
					// query to just /b or /h, rather than clearing it, unless
					// it's already a command, in which case, clear it
				if (
					this.mode == "tabs" ||
					this.mode == "command" ||
					searchBoxText == BookmarksQuery ||
					searchBoxText == HistoryQuery
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
		},


		getMatchingItems: function(
			query)
		{
				// score the items before checking the query, in case there had
				// been a previous query, leaving hitMasks on all the items.
				// if the query is now empty, we need to clear the hitMasks from
				// all the items so no chars are shown matching.
			const items = scoreItems(this[this.mode], query, this.settings[k.UsePinyin.Key]);

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

			const firstScoresDiff = (items.length > 1 && items[0].score > MinScore)
				? items[0].score - items[1].score
				: 0;
				// drop barely-matching results, keeping a minimum of 3,
				// unless there's a big difference in scores between the
				// first two items, which may mean we need a longer tail
			const matchingItems = _.dropRightWhile(items, ({score}, i) =>
				score < NearlyZeroScore ||
					(score < MinScore && (i + 1 > MinItems || firstScoresDiff > MinScoreDiff))
			);

			return matchingItems;
		},


		openItem: async function(
			item,
			shiftKey,
			modKey)
		{
			if (item) {
				const {url} = item;
				let tabOrWindow;

					// set this manually before awaiting any calls below, since
					// the onblur handler will fire when the item is opened
				this.closeWindowCalled = true;

				if (this.mode == "tabs") {
					if (item.sessionId) {
							// this is a closed tab, so restore it
						tabOrWindow = await cp.sessions.restore(item.sessionId);
						this.props.tracker.event("tabs", "restore");
					} else {
							// switch to the tab
						tabOrWindow = await this.focusTab(item, shiftKey);
					}
				} else if (shiftKey) {
						// open in a new window
					tabOrWindow = await cp.windows.create({ url });
					this.props.tracker.event(this.mode, "open-new-win");
				} else if (modKey) {
						// open in a new tab
					tabOrWindow = await cp.tabs.create({ url });
					this.props.tracker.event(this.mode, "open-new-tab");
				} else {
						// open in the active tab, which, in the case of a popup,
						// is not in the current window (since it's the popup)
					const {id} = await this.getActiveTab();

					tabOrWindow = await cp.tabs.update(id, { url });
					this.props.tracker.event(this.mode, "open");
				}

				if (this.props.isPopup) {
					this.closeWindow(false, tabOrWindow);
				} else {
						// we seem to have to close the window in a timeout so that
						// the hover state of the button gets cleared
					setTimeout(this.closeWindow, 0);
				}
			}
		},


		focusTab: function(
			tab,
			unsuspend)
		{
			if (tab) {
				const updateData = { active: true };
				const queryLength = this.state.query.length;
				const category = queryLength ? "tabs" : "recents";
				let event = (category == "recents" && this.gotMRUKey) ?
					"focus-mru" : "focus";

				if (unsuspend && tab.unsuspendURL) {
						// change to the unsuspended URL
					updateData.url = tab.unsuspendURL;
					event = "unsuspend";
				}

				this.props.tracker.event(category, event,
					queryLength ? queryLength : this.state.selected);

					// bring the tab's window forward *before* focusing the tab,
					// since activating the window can sometimes put keyboard
					// focus on the very first tab button on macOS 10.14 (could
					// never repro on 10.12).  then focus the tab, which should
					// fix any focus issues.
				return cp.windows.update(tab.windowId, { focused: true })
					.then(() => cp.tabs.update(tab.id, updateData))
					.then(() => popupWindow.show(tab))
					.catch(error => {
						this.props.tracker.exception(error);
						log(error);
					});
			}
		},


			// although this method also deletes bookmarks/history items, keep
			// the closeTab name since that's the name of the shortcut setting
		closeTab: function(
			item)
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
		},


		moveTab: function(
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

					return cp.tabs.move(tab.id, {
						windowId: activeTab.windowId,
						index: index
					});
				})
				.then(movedTab => {
//					const {selected} = this.state;

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

// TODO: this is only needed if we don't focus the tab after moving it
//					return this.loadTabs()
//						.then(() => this.setState({ selected }));
				});
		},


		copyItemURL: function(
			item,
			includeTitle)
		{
			if (item) {
				const text = (includeTitle ? item.title + "\n" : "") +
					(item.unsuspendURL || item.url);

				copyTextToClipboard(text);
			}
		},


		modifySelected: function(
			delta,
			mruKey)
		{
			const index = this.state.selected + delta;

			this.setSelectedIndex(index, mruKey);
//			this.setSelectedIndex(this.state.selected + delta, mruKey);
log("modifySelected", index, this.state.matchingItems[index])
//			this.setState(({selected}) => this.focusTab(this.state.matchingItems[selected + delta]));
			this.focusTab(this.state.matchingItems[index]);
		},


		setSelectedIndex: function(
			index,
			mruKey)
		{
			var length = this.state.matchingItems.length;

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
log("setSelectedIndex", index)

			this.setState({ selected: index });
		},


		getActiveTab: function()
		{
			if (!this.props.isPopup || !this.visible) {
				return cp.tabs.query({ active: true, currentWindow: true })
					.then(([activeTab]) => activeTab);
			} else {
					// since we're in a popup window, get the active tab from
					// the background, which recorded it before opening this
					// window.  we can't use cp.runtime.sendMessage() because
					// it's a shared instance that's on the background page, so
					// calling sendMessage() from there would be going from the
					// background to this window, but we want the opposite.
				return new Promise(resolve =>
					chrome.runtime.sendMessage("getActiveTab", resolve));
			}
		},


		updateSettings: function(
			settings)
		{
			this.settings = settings;
			this.mruModifier = settings.chrome.popup.modifierEventName;
			shortcuts.update(settings);

			return settings;
		},


		showWindow: function({
			focusSearch,
			activeTab})
		{
				// set visible before calling loadTabs(), since that will call
				// getActiveTab(), which checks visible
			this.visible = true;
			this.closeWindowCalled = false;

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
				// activates the selected item
			this.gotModifierUp = false;
			this.gotMRUKey = true;

				// get the latest settings, in case they've changed, so that
				// they'll be available in loadTabs()
			this.settingsPromise = settings.get()
				.then(this.updateSettings);

				// the tab list should already be correct in most cases, but
				// load them again just to make sure
			return this.loadTabs()
				.then(() => popupWindow.show(activeTab));
		},


		closeWindow: function(
			closedByEsc,
			focusedTabOrWindow)
		{
			this.closeWindowCalled = true;

			if (!this.props.isPopup) {
				window.close();

				return Promise.resolve();
			} else {
 				this.forceUpdate = true;
				this.resultsList.scrollToRow(0);
				this.onQueryChange({ target: { value: "" }});
				this.visible = false;

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
		},


		handleListRef: handleRef("resultsList"),


		handleSearchBoxRef: handleRef("searchBox"),


		onTabRemoved: function()
		{
			const {selected} = this.state;

				// refresh the results list so that the newly closed tab
				// will show in the closed list, and if there are multiple
				// tabs with the same name, their index numbers will update.
				// loadTabs() calls loadPromisedItems(), which calls setQuery(),
				// which will reset the selected index to 0.  so after the tabs
				// are reloaded, set selected back to what it was, limiting it
				// to the current items length, in case the user had closed the
				// very last item in the list.
			this.loadTabs()
				.then(() => this.setState(({matchingItems}) =>
					({ selected: Math.min(selected, matchingItems.length - 1) })));
		},


		onQueryChange: function(
			event)
		{
			this.setSearchBoxText(event.target.value);
		},


		onKeyDown: function(
			event)
		{
				// reset this on every keyDown so we know if the user had typed
				// an alt-W or alt-shift-W before releasing alt.  it will get set
				// to true in setSelectedIndex().
			this.gotMRUKey = false;

				// keydown handling is managed in another module
			return shortcuts.handleEvent(event, this);
		},


		onKeyUp: function(
			event)
		{
			if (event.key == this.mruModifier) {
				if (!this.gotModifierUp && this.gotMRUKey && this.state.selected > -1) {
					this.setSelectedIndex(-1);
					this.closeWindow();

					const tab = this.state.matchingItems[this.state.selected];
					cp.windows.update(tab.windowId, { focused: true })
						.then(() => cp.tabs.update(tab.id, { active: true }));
//					this.openItem(this.state.matchingItems[this.state.selected]);
				}

				this.gotModifierUp = true;
				this.gotMRUKey = false;
			}
		},


		onOptionsClick: function()
		{
			chrome.tabs.create({
				url: chrome.extension.getURL("options.html")
			});
			this.props.tracker.event("extension", "open-options");
		},


		onMessage: function({
			message,
			...payload})
		{
			switch (message) {
				case "modifySelected":
					this.modifySelected(payload.direction, true);
					break;

				case "tabActivated":
//					this.loadTabs();
					break;

				case "showWindow":
log("showWindow", payload)
					this.showWindow(payload);
					break;

				case "focusSearch":
					this.gotMRUKey = false;
					this.tabsPromise.then(() => this.setState({ selected: -1 }));
					break;
			}
		},


		onWindowBlur: async function()
		{
			if (!this.closeWindowCalled) {
					// only call this if we're losing focus because the user
					// clicked another window, and not from pressing esc.  get
					// the active tab so it can get passed to popupWindow.hide(),
					// where it'll be the target window to hide the popup behind.
				this.closeWindow(false, await this.getActiveTab());
			}

			this.closeWindowCalled = false;
		},


		render: function()
		{
			const {
				query,
				searchBoxText,
				matchingItems,
				selected,
				newSettingsAvailable
			} = this.state;

			return <div className={this.props.platform}>
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
					onItemClicked={this.openItem}
					onTabClosed={this.closeTab}
				/>
			</div>
		}
	});


	return App;
});
