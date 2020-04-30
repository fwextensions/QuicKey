---

title: QuicKey
comments: true

---

# Release history


## 1.5.0 - 2020-04-29

### Added

* [Pinyin](https://en.wikipedia.org/wiki/Pinyin) strings in the search query will now match Chinese characters in tab titles and URLs.  This option is enabled by default if Chrome's language is set to Chinese or if Chinese characters are found in any currently open tabs titles or URLs. 

### Fixed

* When Chrome is running slowly, if a query is typed right after the *QuicKey* shortcut is pressed, and then that query is cleared, letters matching the previous query would still be highlighted in the menu.  


## 1.4.0 - 2020-03-18

### Added

* Dark mode is supported in the *QuicKey* menu and options page when you've enabled it on your OS.

* The number of open tabs can be optionally shown in a badge on the *QuicKey* icon.

* A red dot is shown on the gear icon in the menu when new settings have been added since the last time you've visited the *QuicKey options* page.

* Typing <b><kbd>/</kbd><kbd>b</kbd></b> immediately shows the list of bookmarks, in alphabetical order.  

### Changed

* The *QuicKey* icon is inverted only when the switch to previous/next tab command is used, and not when other interactions cause the current tab to change. 

### Fixed

* The selected item is maintained when closing a tab.  


## 1.3.4 - 2020-01-21

### Fixed

* The matching letters in search results would not be shown correctly in some cases.

* The order of recent tabs was sometimes lost when restarting the browser.  


## 1.3.3 - 2020-01-15

### Added 

* Support for the new Edge browser.  This version only launched in the Edge store.


## 1.3.2 - 2020-01-08

### Fixed

* The current search query is no longer modified when a closed tab is deleted.


## 1.3.1 - 2020-01-04

### Added

* Closed tabs, bookmarks, and entries in the browser history can be deleted by clicking the X button on each item or with the close-tab keyboard shortcut.  

* Ctrl- or cmd-clicking a bookmark or history item will open it in a new tab. 

### Fixed

* Non-breaking spaces and other non-standard space characters in titles will now match spaces typed in the query. 

* Worked around a Chrome bug that caused some Unicode characters like ⌘ to sometimes not be recognized correctly, which could break keyboard shortcuts.

* The list of results will update if a tab is closed while the menu is open.

* Only the unsuspended versions of pages are listed when searching the history.
 

## 1.3.0 - 2019-12-15

### Added

* New option to mark tabs that aren't in the current window with an icon.  The setting defaults on if you have more than 3 windows open when the extension is installed.

* Typing <b><kbd>/</kbd><kbd>h</kbd></b> immediately shows the list of visited web pages, in recency order.  

* Tabs that are opened via ctrl-click or by opening a folder of bookmarks are immediately added to the menu as recently-used tabs, so that you can then use <b><kbd>alt</kbd><kbd>Z</kbd></b> to toggle to a tab you just opened.  

* Function keys and other special keys can be used as shortcuts.

### Changed

* The minimum version of Chrome is now 55.

### Fixed

* Holding down <b><kbd>alt</kbd><kbd>Z</kbd></b> to rapidly switch tabs could cause tabs other than the most recent two to be focused. 

* Moving a tab from the same window to the left of the current tab would position it in the wrong place.
 

## 1.2.0 - 2019-10-12

### Added

* New <b><kbd>alt</kbd><kbd>Z</kbd></b> keyboard shortcut will switch instantly between the two most recent tabs, without requiring a wait of 750ms between presses.

* Clicking the gear icon in the popup menu will open the options page.

* The options page has a help link to the main website, offering more details on how to use the extension.

* The instructions for [using <b><kbd>ctrl</kbd><kbd>tab</kbd></b> as a shortcut](https://fwextensions.github.io/QuicKey/ctrl-tab/) include an option for using it to switch instantly between the two most recent tabs. 


## 1.1.2 - 2019-09-07

### Added

* A tab that has the same title as other open tabs will display a number to indicate its left-to-right position among those other tabs, making it easier to find the tab you want.


## 1.1.1 - 2019-08-31

### Fixed

* On some versions of macOS, using the menu to focus a tab would sometimes put keyboard focus on the first tab in the window, instead of the selected tab.
  

## 1.1.0 - 2019-06-09

### Added

* On the new options page you can change the behavior of the <kbd>space</kbd> and <kbd>esc</kbd> keys, hide closed tabs from the search results, and customize many of the keyboard shortcuts.  In particular, you can change the key that's used to navigate the MRU menu, which is helpful if you change the default <b><kbd>alt</kbd><kbd>Q</kbd></b> shortcut.

* A [support page](https://fwextensions.github.io/QuicKey/support/) on the QuicKey website.

### Changed

* Updated the icon for closed tabs to make it clearer that it's not a button.

### Fixed

* Moving tabs to the left or right of the current one sometimes positions it in the wrong place.

* Improved error handling.


## 1.0.3 - 2019-05-27

### Changed

* When a new version is available, don't reload the extension until the browser restarts.


## 1.0.2 - 2019-01-06

### Fixed

* Keyboard shortcuts like <b><kbd>ctrl</kbd><kbd>W</kbd></b> to navigate the menu don't work with non-QWERTY keyboards.
 

## 1.0.1 - 2018-07-09

### Added

* <b><kbd>ctrl</kbd><kbd>C</kbd></b> keyboard shortcut (<b><kbd>cmd</kbd><kbd>C</kbd></b> on macOS) copies the selected item's URL, and <b><kbd>ctrl</kbd><kbd>shift</kbd><kbd>C</kbd></b> copies the title and URL.

### Changed

* If multiple closed tabs have exactly the same URL, list only the most recent one.

### Fixed

* HTML isn't escaped in recent tab menu when there is no query.

* Maintain recent tab information when a tab is replaced, such as when it's been unloaded from memory by Chrome.

* Skip tabs that were closed without the extension noticing when navigating to earlier tabs.

* Switching to a previous tab via the shortcut key after Chrome restarts without first opening the menu often fails.


## 1.0.0 - 2018-04-09

* First searchable Chrome store release.


## Older releases

Available on [GitHub](https://github.com/fwextensions/QuicKey/releases).
