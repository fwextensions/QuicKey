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
		mode: "tabs",
		tabs: [],
		bookmarks: [],
		history: [],
		recents: [],
		command: [],
		bookmarksPromise: null,
		historyPromise: null,
		forceUpdate: false,
		selectAllSearchBoxText: false,
		gotModifierUp: false,
		gotMRUKey: false,
		mruModifier: "Alt",
		resultsList: null,
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
				.then(async settings => {
					this.settings = settings;
					this.mruModifier = settings.chrome.popup.modifierEventName;
					shortcuts.update(settings);

					if (settings.usePinyin) {
							// searching by pinyin is enabled, so load the lib
							// now, so it's available by the time we init all
							// the tabs and add the pinyin translations
						await loadPinyin();
					}

					return settings;
				});

			return {
				query,
				searchBoxText: query,
				matchingItems: [],
					// default to the first item being selected if we got an
					// initial query
				selected: query ? 0 : -1,
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
			return this.loadPromisedItems(() => this.settingsPromise
				.then(settings => initTabs(
					recentTabs.getAll(settings[k.IncludeClosedTabs.Key]),
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
			this.setState({
				query,
				matchingItems: this.getMatchingItems(query),
				selected: query ? 0 : -1
			});
		},


		clearQuery: function()
		{
			let {searchBoxText} = this.state;

			if (!searchBoxText || this.settings[k.EscBehavior.Key] == k.EscBehavior.Close) {
					// pressing esc in an empty field should close the popup, or
					// if the user checked the always close option
				this.props.port.postMessage("closedByEsc");
				window.close();
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


		openItem: function(
			item,
			shiftKey,
			modKey)
		{
			if (item) {
				if (this.mode == "tabs") {
					if (item.sessionId) {
							// this is a closed tab, so restore it
						chrome.sessions.restore(item.sessionId);
						this.props.tracker.event("tabs", "restore");
					} else {
							// switch to the tab
						this.focusTab(item, shiftKey);
					}
				} else if (shiftKey) {
						// open in a new window
					chrome.windows.create({ url: item.url });
					this.props.tracker.event(this.mode, "open-new-win");
				} else if (modKey) {
						// open in a new tab
					chrome.tabs.create({ url: item.url });
					this.props.tracker.event(this.mode, "open-new-tab");
				} else {
						// open in the same tab
					chrome.tabs.update({ url: item.url });
					this.props.tracker.event(this.mode, "open");
				}

					// we seem to have to close the window in a timeout so that
					// the hover state of the button gets cleared
				setTimeout(function() { window.close(); }, 0);
			}
		},


		focusTab: function(
			tab,
			unsuspend)
		{
			if (tab) {
				var updateData = { active: true },
					queryLength = this.state.query.length,
					category = queryLength ? "tabs" : "recents",
					event = (category == "recents" && this.gotMRUKey) ?
						"focus-mru" : "focus";

				if (unsuspend && tab.unsuspendURL) {
						// change to the unsuspended URL
					updateData.url = tab.unsuspendURL;
					event = "unsuspend";
				}

					// bring the tab's window forward *before* focusing the tab,
					// since activating the window can sometimes put keyboard
					// focus on the very first tab button on macOS 12.14 (could
					// never repro on 12.12).  then focus the tab, which should
					// fix any focus issues.
				cp.windows.update(tab.windowId, { focused: true })
					.then(() => cp.tabs.update(tab.id, updateData))
					.catch(error => {
						this.props.tracker.exception(error);
						log(error);
					});

				this.props.tracker.event(category, event,
					queryLength ? queryLength : this.state.selected);
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
			cp.tabs.query({
				active: true,
				currentWindow: true
			})
				.bind(this)
				.then(function(activeTabs) {
					const activeTab = activeTabs[0];
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
					})
				})
				.then(function(movedTab) {
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
			this.setSelectedIndex(this.state.selected + delta, mruKey);
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

			this.setState({ selected: index });
		},


		handleListRef: handleRef("resultsList"),


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
					this.openItem(this.state.matchingItems[this.state.selected]);
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
