---

title: QuicKey
comments: true

---

# Release history


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
