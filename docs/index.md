---
site.title: QuicKey - A Chrome extension for switching tabs or pulling up bookmarks and history via a Quicksilver-style search.
---

# QuicKey - A Chrome extension for switching tabs or pulling up bookmarks and history via a Quicksilver-style search

![QuicKey](img/icon-128.png)

[![Chrome Webstore](img/webstore.png)]()

If you like to have lots of tabs open in Chrome, it can quickly become difficult to find the one you want.  The tabs get very small, so you have to hover over each one to see its name in a tooltip.  And there's no overall Windows menu that would let you more easily pick a tab from a list.  

*QuicKey* makes tabs much easier to navigate.  Just use its keyboard shortcut to open it, type a few letters of a tab's name or URL, and then press <kbd>enter</kbd>.  You can even search through bookmarks and your browsing history.


## Installation

*QuicKey* can be installed from the Chrome Web Store.  It requires Chrome **vXX** or above.

You can click the <img src="img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"> button on the toolbar to open the search box.  But if you're using this extension, you probably prefer using the keyboard.  The default shortcut on Windows is <kbd>alt + Q</kbd> and on macOS it's <kbd>ctrl + Q</kbd>.  

To change these, you can go to *Settings > Extensions*, scroll to the very bottom of the page, and then click *Keyboard Shortcuts*.  You can then select a different shortcut in the dialog.   


## Switching tabs

When you've opened the *QuicKey* search box, either by pressing the keyboard shortcut or clicking its icon, you can type a few letters of the title or URL of the tab you're looking for.  *QuicKey* uses a [Quicksilver]() style matching algorithm, where contiguous matches at the beginning of words are ranked highly, as are matches against capital letters at the beginning of words.  This should let you type just a few letters to find the right tab.
 
The first matched tab is selected by default, so you can just press <kbd>enter</kbd> to switch to it.  Or press the <kbd>&#8593;</kbd> or <kbd>&#8595;</kbd> key to move to other results.  You can also click the desired tab using the mouse.
  
Press <kbd>esc</kbd> to clear what you've typed.  If the search box is empty, then pressing <kbd>esc</kbd> will close it. 
 
If you use the handy extension [The Great Suspender](https://chrome.google.com/webstore/detail/the-great-suspender/klbibkeccnjlkjkiokjodocebajanakg?hl=en) (and you almost certainly are if you have hundreds of tabs open), then suspended tabs will have a faded icon in the list.  Pressing <kbd>enter</kbd> will switch to the suspended tab, but you can press <kbd>shift</kbd><kbd>enter</kbd> to switch to the tab and unsuspend it in one go.  


## Searching bookmarks and visited pages

Besides tabs, you can also quickly open bookmarks or visited pages using *QuicKey*.  To search all of your bookmarks in Chrome, type `/b` followed by a space, and then start typing part of the name or URL of a bookmark.  
   
When you've selected the desired bookmark, press <kbd>enter</kbd> to open it in the current tab.  Press <kbd>ctrl</kbd><kbd>enter</kbd> to open the bookmark in a new tab in the current window, or press <kbd>shift</kbd><kbd>enter</kbd> to open the bookmark in a new window.    

To match a page from your browsing history, type `/h`, a space and then start typing part of the name or URL of a page.  The same <kbd>ctrl</kbd><kbd>enter</kbd> and <kbd>shift</kbd><kbd>enter</kbd> shortcuts work with visited pages to open them in new tabs or windows.  Currently, only the last 100 pages in the history are available for searching through *QuicKey*.


## Permissions needed by the extension


## Credits

X
Attribution-Non-Commercial 3.0 Netherlands (help for licenses) http://creativecommons.org/licenses/by-nc/3.0/nl/deed.en_GB
P.J. Onori
http://www.somerandomdude.com/

search
Octicons https://www.iconfinder.com/search/?q=iconset%3Aocticons
http://opensource.org/licenses/MIT
