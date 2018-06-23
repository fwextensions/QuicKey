---

title: QuicKey

---

# Using <kbd>ctrl</kbd><kbd>tab</kbd> as a QuicKey shortcut

Do you wish Chrome had the same <b><kbd>ctrl</kbd><kbd>tab</kbd></b> tab navigation as Firefox?  There are two key features Chrome is missing:

- **To switch to the previously used tab**
  - Press <kbd>ctrl</kbd><kbd>tab</kbd> and then release both keys

- **To select an open tab from a menu using the keyboard**
  - Press <kbd>ctrl</kbd><kbd>tab</kbd> but then release just <kbd>tab</kbd>
  - Press and release <kbd>tab</kbd> repeatedly to select older tabs in the menu
  - Release <kbd>ctrl</kbd> to switch to the selected tab

Chrome extensions can't provide this functionality all by themselves, unfortunately.  With a little work, however, it *is* possible to achieve both these features with *QuicKey*, though the second one requires some additional Windows-only software.  (*QuicKey* does support [keyboard-driven selection](/QuicKey/#mru) of a tab from a menu without any additional setup; it's just that you can't use <b><kbd>ctrl</kbd><kbd>tab</kbd></b> as the shortcut.)


## Use <b><kbd>ctrl</kbd><kbd>tab</kbd></b> to switch to previously used tabs

Chrome's *Keyboard shortcuts* screen normally blocks you from using <b><kbd>ctrl</kbd><kbd>tab</kbd></b> as a shortcut, but it is possible to use the Chrome developer tools to work around this limitation (and is much simpler than other approaches that require messing around with Chrome's preferences files).

1. Install [QuicKey](https://chrome.google.com/webstore/detail/quickey-%E2%80%93-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg) from the Chrome webstore.

2. Right-click the *QuicKey* icon <img src="../img/icon-38.png" style="height: 19px; vertical-align: text-bottom;"> and select *Options* from the menu.

3. After the *Keyboard shortcuts* page opens, press <kbd>ctrl</kbd><kbd>shift</kbd><kbd>J</kbd> on Windows/Linux or <kbd>cmd</kbd><kbd>opt</kbd><kbd>J</kbd> on macOS to open Chrome DevTools.

4. Copy this block of code:

       chrome.developerPrivate.updateExtensionCommand({
           extensionId: "ldlghkoiihaelfnggonhjnfiabmaficg",
           commandName: "1-previous-tab",
           keybinding: "Ctrl+Tab"
       });
       chrome.developerPrivate.updateExtensionCommand({
           extensionId: "ldlghkoiihaelfnggonhjnfiabmaficg",
           commandName: "2-next-tab",
           keybinding: "Ctrl+Shift+Tab"
       });

    <button class="copy" onclick="copyCode()">Copy to Clipboard</button>

5. Click into the console area of DevTools and paste the code next to the >.

6. Press <kbd>enter</kbd> to run it.

That's it!

Now you can press <b><kbd>ctrl</kbd><kbd>tab</kbd></b> to switch to the previously used tab.  If you press it again within .75 seconds, while the icon is inverted <img src="../img/icon-38-inverted.png" style="height: 19px; vertical-align: text-bottom;">, you'll switch to the tab before that.  You can press <b><kbd>ctrl</kbd><kbd>shift</kbd><kbd>tab</kbd></b> to navigate in the other direction.

> You should always be cautious about copying code from a website and running it in DevTools, but even if you don't know JavaScript, it's hopefully clear what the snippet above is doing.  It's calling a private updateExtensionCommand() function twice to set <b><kbd>ctrl</kbd><kbd>tab</kbd></b> and <b><kbd>ctrl</kbd><kbd>shift</kbd><kbd>tab</kbd></b> keyboard shortcuts.  The "ldlghkoiihaelfnggonhjnfiabmaficg" string is *QuicKey*'s extension ID, which you can see in its [Chrome webstore link](https://chrome.google.com/webstore/detail/quickey-%E2%80%93-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg), so it won't affect any other extensions you have installed.

If you later change your mind and want to remove these shortcuts, just go back into the *Keyboard shortcuts* screen and click the delete button next to the shortcuts, or change them to something else.


## Use <b><kbd>ctrl</kbd><kbd>tab</kbd></b> to select an open tab from a menu (Windows only)


<b><kbd>ctrl</kbd><kbd>tab</kbd></b>



1. Install [QuicKey](https://chrome.google.com/webstore/detail/quickey-%E2%80%93-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg) from the Chrome webstore.

2. Download and install [AutoHotkey](https://www.autohotkey.com/download/ahk-install.exe), a utility for remapping keys on Windows.

3. Download [ctrl-tab.ahk](ctrl-tab.ahk)

- Open your PC's startup folder by following [these instructions](https://www.autohotkey.com/docs/FAQ.htm#Startup).
- Go to [this page](https://gist.github.com/fwextensions/511e0f6886eac3d07cf7a21fbb10a6c7) and click *Download ZIP*.
- Unzip the archive and drag the `ctrl-tab.ahk` file from the ZIP into your startup folder.
- Double-click the `ctrl-tab.ahk` file.

Now switch between a few different tabs in Chrome using the mouse (since *QuicKey* was just installed, it won't have any recent tab history).  Then press and release <b><kbd>ctrl</kbd><kbd>tab</kbd></b> to switch to the previous tab.  If you press <b><kbd>ctrl</kbd><kbd>tab</kbd></b> and keep holding <kbd>ctrl</kbd>, a menu of recent tabs will open.  Press <kbd>tab</kbd> to move the selection down in the list, <b><kbd>shift</kbd><kbd>tab</kbd></b> to move up.  When the desired tab is selected, release <kbd>ctrl</kbd> to switch to it.

The other shortcuts listed above continue to work, so you can still press <b><kbd>alt</kbd><kbd>Q</kbd></b> to open *QuicKey* and search for a tab instead of picking a recent one.


<script>
    function copyCode()
    {
        var copyFrom = document.createElement("textarea"),
            body = document.body,
            result;

        copyFrom.textContent = document.getElementsByClassName("highlight")[1].textContent;
        body.appendChild(copyFrom);
        copyFrom.select();
        result = document.execCommand("copy");
        body.removeChild(copyFrom);

        if (!result) {
            alert("The browser blocked the copy action for some reason.");
        }
    }
</script>