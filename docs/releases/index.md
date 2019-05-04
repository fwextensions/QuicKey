---

title: QuicKey
comments: true

---

# Release history


## 1.0.2 - 2019-01-06

* Fix: keyboard shortcuts like <b><kbd>ctrl</kbd><kbd>W</kbd></b> to navigate 
the menu did not work with non-QWERTY keyboards.
 

## 1.0.1 - 2018-07-09

* Add: <b><kbd>ctrl</kbd><kbd>C</kbd></b> keyboard shortcut (<b><kbd>cmd</kbd><kbd>C</kbd></b> on macOS) to copy the selected item's URL, and <b><kbd>ctrl</kbd><kbd>shift</kbd><kbd>C</kbd></b> to copy the title and URL.
* Change: if multiple closed tabs have exactly the same URL, list only the most recent one.
* Fix: HTML isn't escaped in recent tab menu when there is no query.
* Fix: maintain recent tab information when a tab is replaced, such as when it's been unloaded from memory by Chrome.
* Fix: skip tabs that were closed without the extension noticing when navigating to earlier tabs.
* Fix: switching to a previous tab via the shortcut key after Chrome restarts without first opening the menu often fails.


## 1.0.0 - 2018-04-09

* First searchable Chrome store release.


## Older releases

Available on [GitHub](https://github.com/fwextensions/QuicKey/releases).
