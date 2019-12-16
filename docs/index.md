---

title: QuicKey
image: img/og-image.png
comments: true

---

<div class="glide">
  <div class="glide__track" data-glide-el="track">
    <ul class="glide__slides">
      <li class="glide__slide"><img src="img/screenshot-1.png"></li>
      <li class="glide__slide"><img src="img/screenshot-2.png"></li>
      <li class="glide__slide"><img src="img/screenshot-3.png"></li>
      <li class="glide__slide"><img src="img/screenshot-4.png"></li>
    </ul>
  </div>
</div>

<script src="assets/js/glide.js"></script>
<script>
	new Glide(".glide", {
		type: "carousel",
		gap: 0,
		autoplay: 6000,
		hoverpause: true
	}).mount();
</script>

#### *QuicKey* lets you navigate all of your Chrome tabs by typing just part of a page's title or URL.  No mouse needed!

  * Press <b><kbd>alt</kbd><kbd>Q</kbd></b> (<b><kbd>ctrl</kbd><kbd>Q</kbd></b> on macOS).
  * Type a few letters.
  * Press <kbd>enter</kbd> to switch to the selected tab.

To toggle between the two most recently used tabs, quickly press the keyboard shortcut twice.  Or pick a tab from the most recently used (MRU) list as [shown below](#mru).


## Use <b><kbd>ctrl</kbd><kbd>tab</kbd></b> as a QuicKey shortcut

With a little extra work, you can even make *QuicKey* respond to the Holy Grail of keyboard shortcuts: <b><kbd>ctrl</kbd><kbd>tab</kbd></b>.  [Learn how](ctrl-tab).


## Installation

<p class="install"><button onclick="installExtension(1)">Add to Chrome</button> or go to the <a href="https://chrome.google.com/webstore/detail/quickey-–-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg">Chrome Web Store</a> to install <em>QuicKey</em>.</p>

<p class="install-fallback" style="display: none">Go to the <a href="https://chrome.google.com/webstore/detail/quickey-–-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg">Chrome Web Store</a> in Chrome to install <em>QuicKey</em>.</p>

Once the extension is installed, you can click the <img src="img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"> button on the toolbar to open the search box.  But if you like this extension, you'll probably prefer using the default keyboard shortcut listed above.

You can customize the shortcut key by right-clicking the *QuicKey* icon and selecting *Options*.  Or manually add a <b><kbd>ctrl</kbd><kbd>tab</kbd></b> [keyboard shortcut](ctrl-tab).


## <a name="mru"></a>Switch between the most recently used tabs

> **Note:** When first installed, *QuicKey* doesn't know which tabs have been recently used, but as you use Chrome, it will start adding tabs to the most recently used (MRU) list.

Opening *QuicKey* displays a list of the last 50 tabs you've visited, in order of recency.  Click a tab to switch to it, or use one of the keyboard shortcuts below to navigate the recently used tab history:

<p style="margin-bottom: 0;">&nbsp;</p>

  * **To switch between the two most recent tabs:**
      * Press <b><kbd>alt</kbd><kbd>Z</kbd></b> (<b><kbd>ctrl</kbd><kbd>Z</kbd></b> on macOS). 
          * **OR**      
      * Quickly double-press <b><kbd>alt</kbd><kbd>Q</kbd></b> (<b><kbd>ctrl</kbd><kbd>Q</kbd></b> on macOS).

<p style="margin-bottom: 0;">&nbsp;</p>

  * **To navigate farther back in the MRU list:**
    * Press <b><kbd>alt</kbd><kbd>A</kbd></b> (<b><kbd>ctrl</kbd><kbd>A</kbd></b> on macOS) once to switch to the previous tab.  The *QuicKey* icon will invert for .75 seconds: <b><img src="img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"> ➤ <img src="img/icon-38-inverted.png" style="height: 19px; vertical-align: text-bottom;"></b>.
    * Press <b><kbd>alt</kbd><kbd>A</kbd></b> again while the icon is inverted to switch to older tabs, once for each tab.
    * Press <b><kbd>alt</kbd><kbd>S</kbd></b> to move to newer tabs.
    * Pause to let the icon revert to normal: <b><img src="img/icon-38-inverted.png" style="height: 19px; vertical-align: text-bottom;"> ➤ <img src="img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"></b>.
    * Press <b><kbd>alt</kbd><kbd>A</kbd></b> again to switch back to the tab you initially started on.

<p style="margin-bottom: 0;">&nbsp;</p>

  * <a name="mru-gif"></a>**To pick a recent tab from the MRU menu:**
    * Press the shortcut but keep holding the <kbd>alt</kbd> key (<kbd>ctrl</kbd> key on macOS).
    * Press <kbd>W</kbd> or <kbd>↓</kbd> to move down through the list of recent tabs.
    * Press <b><kbd>shift</kbd><kbd>W</kbd></b> or <kbd>↑</kbd> to move up.
    * Release <kbd>alt</kbd> (or <kbd>ctrl</kbd>) to switch to the selected tab.
    * You can also highlight an item with the mouse, then release <kbd>alt</kbd> to go to that tab.

![MRU tab list](img/mru-menu.gif)

Which shortcuts to use is up to you.  Double-pressing <b><kbd>alt</kbd><kbd>Q</kbd></b> is nice because there's just one shortcut to remember, while <b><kbd>alt</kbd><kbd>Z</kbd></b> lets you switch between the two most recently used tabs very rapidly.  (You can also double-click the *QuicKey* icon to toggle between the most recent tabs.)

<b><kbd>alt</kbd><kbd>A</kbd></b> lets you navigate to even older tabs, though the timing can sometimes be finicky.

Selecting from the MRU menu by holding down the <kbd>alt</kbd> key provides the closest experience to a typical <b><kbd>alt</kbd><kbd>tab</kbd></b> menu, but you need to use <kbd>W</kbd> instead of <kbd>tab</kbd> to navigate while the menu is open (due to limitations in the Chrome platform).

You can change any of these shortcuts by clicking the <img src="img/gear.svg" style="height: 1em"> icon in the menu or by right-clicking the *QuicKey* icon and selecting *Options*.  Then scroll down and click *Change Chrome shortcuts*. Look for the *Switch to the previous/next tab* shortcuts.


## Search for a tab quickly

Unlike other tab switchers, *QuicKey* uses a [Quicksilver](https://qsapp.com/)-style search algorithm to rank the results, where contiguous matches at the beginning of words are higher in the list, as are matches against capital letters.  So you only have to type a few letters to quickly find the right tab.

Use keyboard shortcuts to navigate the list of matching tabs:

  * <kbd>enter</kbd>&nbsp;: switch to the selected tab
  * <kbd>↓</kbd> or <kbd>space</kbd>&nbsp;: move down the list
  * <kbd>↑</kbd> or <b><kbd>shift</kbd><kbd>space</kbd></b>&nbsp;: move up the list
  * <kbd>pg dn</kbd>&nbsp;: page down the list
  * <kbd>pg up</kbd>&nbsp;: page up the list
  * <kbd>end</kbd>&nbsp;: go to the bottom of the list
  * <kbd>home</kbd>&nbsp;: go to the top of the list
  * <kbd>esc</kbd>&nbsp;: clear the search or close the menu

If you type more than 25 letters, which should be plenty to find the right tab, *QuicKey* switches to an exact string search to stay fast.

Recently used tabs get a slight boost in the search results ranking, so getting back to a tab you were just using should require typing fewer letters.


## Customize shortcuts and other options

To customize how *QuicKey* behaves, click the <img src="img/gear.svg" style="height: 1em"> icon in the menu, or right-click its toolbar icon <img src="img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"> and select *Options* from the menu:

<img src="img/options-in-menu.png" style="width: 208px;">

On the *QuicKey options* page, you can change the behavior of the <kbd>space</kbd> and <kbd>esc</kbd> keys, hide closed tabs from the search results, and customize many of the keyboard shortcuts described here.

If you change the keyboard shortcut for showing the *QuicKey* menu to something other than the default <b><kbd>alt</kbd><kbd>Q</kbd></b> or if you have a non-US keyboard, you'll probably want to also change the key that's used to navigate down the list of recently used tabs (which defaults to <kbd>W</kbd>).  For instance, if you change the menu shortcut to <b><kbd>alt</kbd><kbd>Z</kbd></b>, you might want to change the navigation key to <kbd>X</kbd>, which is right next door.  To change it, go to the *Options* page, click in the first keyboard shortcut picker, and press <kbd>X</kbd>.


## Close and reopen tabs

To close the selected tab, press <b><kbd>ctrl</kbd><kbd>W</kbd></b> (<b><kbd>cmd</kbd><kbd>ctrl</kbd><kbd>W</kbd></b> on macOS).  Or hover over a tab and click the close button on the right side of the menu:

![Close button](img/close-button.png)

When you open *QuicKey*, the 25 most recently closed tabs are listed below the recent tabs and shown in a faded state with a <img src="img/history.svg" style="height: 1em"> icon:

![Closed tab](img/closed-tab.png)

They are also returned when you type a query, though their score is discounted compared to open tabs.  Click a closed tab to reopen it in its original location and with all of its browsing history intact.

If you don't want closed tabs to be shown, open the *QuicKey options* page and uncheck *Include recently closed tabs in the search results*.


## Move tabs

You can move tabs to the left or right of the current tab, making it easy to pull tabs from other windows into the current one, or to rearrange tabs without using the mouse.

  * Press <b><kbd>ctrl</kbd><kbd>[</kbd></b> to move the selected tab to the left of the current one.
  * Press <b><kbd>ctrl</kbd><kbd>]</kbd></b> to move it to the right.

Include <kbd>shift</kbd> in the shortcut to also unsuspend the tab while moving it.  The <kbd>ctrl</kbd> key should be used on both Windows and macOS.  Note that you cannot move tabs between normal and incognito windows.


## Distinguish tabs with identical titles

A tab that has the same title as other open tabs will display a number to indicate its left-to-right position among those other tabs.  For instance, if you open tabs for two different Google Drive accounts, they'll both be titled *My Drive - Google Drive*.  But the one on the left will show a **1** next to its title in the menu and the one on the right will show a **2**.  This makes it easier for you to select the tab you want when you know how they're organized in your window.   


## <a name="bookmarks"></a>Search bookmarks

To find a bookmark, type <b><kbd>/</kbd><kbd>b</kbd><kbd>space</kbd></b> in the search box, and then part of the bookmark's name or URL.

![Search bookmarks](img/search-bookmarks.png)

  * Press <kbd>enter</kbd> to open the bookmark in the current tab.
  * Press <b><kbd>ctrl</kbd><kbd>enter</kbd></b> (<b><kbd>cmd</kbd><kbd>enter</kbd></b> on macOS) to open it in a new tab in the current window.
  * Press <b><kbd>shift</kbd><kbd>enter</kbd></b> to open it in a new window.


## <a name="history"></a>Search the browser history

To find something in the last 2000 pages of your browser history, type <b><kbd>/</kbd><kbd>h</kbd><kbd>space</kbd></b> in the search box, and then part of the page's name or URL.

![Search history](img/search-history.png)

The same <b><kbd>ctrl</kbd><kbd>enter</kbd></b> (<b><kbd>cmd</kbd><kbd>enter</kbd></b> on macOS) and <b><kbd>shift</kbd><kbd>enter</kbd></b> shortcuts will open the visited page in a new tab or window.

As soon as you type <b><kbd>/</kbd><kbd>h</kbd><kbd>space</kbd></b>, the pages from your history will be listed in order of recency, so you can get back to a page you had visited without having to remember its name.


## <a href="https://chrome.google.com/webstore/detail/the-great-suspender/klbibkeccnjlkjkiokjodocebajanakg?hl=en"><img src="img/tgs-icon.png" style="height: 24px;"></a> The Great Suspender integration

If you use the handy extension [The Great Suspender](https://chrome.google.com/webstore/detail/the-great-suspender/klbibkeccnjlkjkiokjodocebajanakg?hl=en) (and you almost certainly do if you have hundreds of tabs open), then suspended tabs will look faded in the list:

![Suspended tab](img/suspended-tab.png)

The original URL is shown in the menu (not that long `chrome-extension://` one you see in the location bar). That means if you search for `chrome` or `extension`, you won't simply match all the suspended tabs, which is what happens in other tab search extensions.

Press <b><kbd>shift</kbd><kbd>enter</kbd></b> to switch to a tab and unsuspend it in one go. Or shift-click it with the mouse.


## Incognito mode

To switch to incognito tabs as well as normal ones, click the <img src="img/gear.svg" style="height: 1em"> icon in the menu, or right-click the *QuicKey* icon <img src="img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"> and select *Options* from the menu:

<img src="img/options-in-menu.png" style="width: 208px;">

Scroll to the very bottom of the *QuicKey options* page and then click the *Change incognito settings* button.  On the extensions page that opens, scroll down to the *Allow in incognito* option and click the toggle button:

![Incognito option](img/incognito-option.png)

Tabs in incognito mode display the incognito icon under the page's favicon, so you can distinguish a normal tab from an incognito one with the same title:

![Incognito tab](img/incognito-tab.png)


## Copy a URL or title

You can also copy the URL and title of the selected tab, bookmark or history item:

  * Press <b><kbd>ctrl</kbd><kbd>C</kbd></b> (<b><kbd>cmd</kbd><kbd>C</kbd></b> on macOS) to copy just the URL.
  * Press <b><kbd>ctrl</kbd><kbd>shift</kbd><kbd>C</kbd></b> (<b><kbd>cmd</kbd><kbd>shift</kbd><kbd>C</kbd></b> on macOS) to copy both the item's title and its URL, one per line.


## Privacy policy

When first installed, *QuicKey* asks for these permissions:

- *Read and change your browsing history on all signed-in devices*

    *QuicKey* uses this permission to let you search the titles and URLs of the open tabs, as well as pages from your history. The *"all signed-in devices"* part is there only so that recently closed tabs can be restored with their full history.

- *Read and change your bookmarks*

    *QuicKey* uses this permission to let you search the titles and URLs of your bookmarked pages. It will never change your bookmarks.

*QuicKey* can't access or manipulate the content of any pages you visit and doesn't transmit any information other than some anonymized diagnostic data.

If you right-click the *QuicKey* icon on the toolbar, there's a message saying *Can't read or change site's data*, which is a bit misleading, since it can't read or change *any* site's data, not just the current one.

For the technically-minded, you can inspect *QuicKey*'s code on [GitHub](https://github.com/fwextensions/QuicKey).


## Feedback and support

If you find a bug in *QuicKey* or have a suggestion for a new feature, please visit the [support page](./support).


## Release history

View the changes in [previous releases](./releases).


## Credits

The <img src="img/gear.svg" style="height: 1em">, <img src="img/search.svg" style="height: 1em"> and <img src="img/clear.svg" style="height: 1em; vertical-align: middle;"> icons are from the [Octicons](https://octicons.github.com/) set, used under the [MIT License](http://opensource.org/licenses/MIT).  The <img src="img/history.svg" style="height: 1em"> icon is from the [Material Icons](https://material.io/tools/icons/) set, used under the [Apache License](https://www.apache.org/licenses/LICENSE-2.0.html).

The string ranking algorithm is modeled on [Quicksilver](https://github.com/quicksilver/Quicksilver/blob/master/Quicksilver/Code-QuickStepCore/QSense.m)'s code.
