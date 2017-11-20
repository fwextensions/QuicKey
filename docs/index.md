---
image: img/search-results-open.png
---

<img src="img/search-results-open.png" style="box-shadow: 0px 5px 30px 4px rgba(0, 0, 0, 0.1);" alt="QuicKey search results">

If you like to keep lots of tabs open in Chrome, it can quickly become difficult to find the one you want.  The tabs get very small, so you have to hover over each one to see its name in a tooltip.  And there's no overall Windows menu that would let you more easily pick a tab from a list.

*QuicKey* lets you navigate your hundreds of Chrome tabs by typing just part of the page's title or URL.  No mouse needed!

  * Press the customizable shortcut:
      * Windows: <kbd>alt</kbd>&nbsp;<kbd>Q</kbd>
      * macOS: <kbd>ctrl</kbd>&nbsp;<kbd>Q</kbd>
  * Type a few letters
  * Press enter to switch to the selected tab

Or quickly switch to a recently used tab:

  * Press the shortcut and hold down <kbd>alt</kbd>
  * Press <kbd>alt</kbd>&nbsp;<kbd>W</kbd> to move through the recent tabs
  * Release <kbd>alt</kbd> to switch to the selected tab


You can also type <kbd>/</kbd>&nbsp;<kbd>b</kbd> to search bookmarks or <kbd>/</kbd>&nbsp;<kbd>h</kbd> to search your browser history.


## Installation

Install *QuicKey* from the [Chrome Web Store](https://chrome.google.com/webstore/detail/quickey-–-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg).

Once the extension is installed, you can click the <img src="img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"> button on the toolbar to open the search box.  But if you're using this extension, you probably prefer using the default keyboard shortcut listed above.

To change these shortcuts, you can open the main menu and then go to *More tools > Extensions*, scroll to the very bottom of the page, and then click *Keyboard Shortcuts*.


## Search for a tab quickly

Unlike other tab switchers, *QuicKey* uses a [Quicksilver](https://qsapp.com/)-style search algorithm to rank the results, where contiguous matches at the beginning of words are higher in the list, as are matches against capital letters at the beginning of words.  So you can type just a few letters to quickly find the right tab.

The best match is selected by default, so press <kbd>enter</kbd> to switch to that tab.  Or press the <kbd>&#8593;</kbd>, <kbd>&#8595;</kbd>, <kbd>pg up</kbd> or <kbd>pg dn</kbd> keys to move to other results.  Like in Quicksilver, you can also press <kbd>space</kbd> or <kbd>shift</kbd>&nbsp;<kbd>space</kbd> to move the selection down or up.  Or just click the tab you want.

Press <kbd>esc</kbd> to clear what you've typed.  If the search box is empty, then pressing <kbd>esc</kbd> will close it.

If you type more than 25 letters, which should be plenty to find the right tab, *QuicKey* switches to an exact string search to stay fast.  Spaces in the search string are also ignored.


## Search bookmarks

To find a bookmark, type <kbd>/</kbd>&nbsp;<kbd>b</kbd>&nbsp;<kbd>space</kbd>, and then part of the bookmark's name or URL.

  * Press enter to open the bookmark in the current tab
  * Press <kbd>ctrl</kbd>&nbsp;<kbd>enter</kbd> (<kbd>cmd⌘</kbd>&nbsp;<kbd>enter</kbd> on macOS) to open it in a new tab in the current window
  * Press <kbd>shift</kbd>&nbsp;<kbd>enter</kbd> to open it in a new window


## Search history

To find something in the last 2000 pages of your browser history, type <kbd>/</kbd>&nbsp;<kbd>h</kbd>&nbsp;<kbd>space</kbd>, and then part of the page's name or URL.

The same <kbd>ctrl</kbd>&nbsp;<kbd>enter</kbd> (<kbd>cmd⌘</kbd>&nbsp;<kbd>enter</kbd> on macOS) and <kbd>shift</kbd>&nbsp;<kbd>enter</kbd> shortcuts will open the visited page in a new tab or window.


## The Great Suspender <a href="https://chrome.google.com/webstore/detail/the-great-suspender/klbibkeccnjlkjkiokjodocebajanakg?hl=en"><img src="img/tgs-icon.png" style="height: 24px;"></a> integration

If you use the handy extension [The Great Suspender](https://chrome.google.com/webstore/detail/the-great-suspender/klbibkeccnjlkjkiokjodocebajanakg?hl=en) (and you almost certainly are if you have hundreds of tabs open), then suspended tabs will look faded in the list, and the original URL is shown (not that long one that you see in the location bar).  That means if you search for `chrome` or `extension`, you won't simply match all the suspended tabs, which is what happens in other tab search extensions.

Press <kbd>shift</kbd>&nbsp;<kbd>enter</kbd> to switch to a tab and unsuspend it in one go. Or shift-click it with the mouse.

Sometimes The Great Suspender seems to forget the page's favicon and just shows its own in the tab.  In that case, *QuicKey* will try to show the correct favicon in its list of tabs.


## Move tabs

You can also move tabs to the left or right of the current tab, making it easy to pull tabs from other windows into the current one.

  * Press <kbd>ctrl</kbd>&nbsp;<kbd>[</kbd> to move the selected tab to the left of the current one
  * Press <kbd>ctrl</kbd>&nbsp;<kbd>]</kbd> to move it to the right

Include <kbd>shift</kbd> in the shortcut to also unsuspend the tab while moving it.  The <kbd>ctrl</kbd> key should be used on both Windows and macOS.


## Close tabs

To close the selected tab, press <kbd>ctrl</kbd>&nbsp;<kbd>W</kbd> (<kbd>cmd⌘</kbd>&nbsp;<kbd>W</kbd> on macOS).  So you could, for instance, type `docg` to match all of your Google Docs URLs and then quickly close each one.


## Incognito mode

By default, Chrome extensions are not enabled in incognito mode when you install them.  If you want to use *QuicKey* to switch to incognito tabs as well as normal ones, open the main menu and then
go to *More tools > Extensions*, scroll down to the *QuicKey* extension, and check the *Allow in incognito* option.

Tabs in incognito mode display the incognito icon, so you can distinguish a normal tab from an incognito one with the same title.


## Privacy

To function, *QuicKey* needs access to your open tabs, bookmarks and history.  The Chrome permissions dialog says *QuicKey* can also change your bookmarks and browsing history, but it never will.  It can't access the page content at all and doesn't transmit any information anywhere, other than anonymized Google Analytics metrics.


## Feedback and bugs

If you find a bug in *QuicKey* or have a suggestion for a new feature, please [create a new issue](https://github.com/fwextensions/QuicKey/issues) on its GitHub page.


## Credits

The <img src="img/search.svg" style="height: 13px"> and <img src="img/clear.svg" style="height: 16px; vertical-align: middle;"> icons are from the [Octicons](https://octicons.github.com/) set, used under the [MIT License](http://opensource.org/licenses/MIT).

String ranking algorithm modeled on [Quicksilver](https://github.com/quicksilver/Quicksilver/blob/master/Quicksilver/Code-QuickStepCore/QSense.m)'s code.
