       // bring the tab's window forward and make the tab active.  both calls are
       // made synchronously, before anything is awaited, because the toolbar menu
       // is an action popup: focusing a browser window takes focus away from it,
       // and Chrome then closes it and destroys its page.  a tabs.update() chained
       // after windows.update() resolved would never be sent, so the menu would
       // just close without switching tabs (issues #170 and #173).  once a call
       // has been dispatched, the browser carries it out even if the page is gone.
       //
       // the window is still focused first, since activating the window can
       // sometimes put keyboard focus on the very first tab button on macOS 10.14
       // (could never repro on 10.12), and focusing the tab afterwards fixes that.
export function activateTab(
       tab,
       options)
{
       const windowFocused = chrome.windows.update(tab.windowId, { focused: true });
       const tabActivated = chrome.tabs.update(tab.id, { active: true, ...options });

       return Promise.all([windowFocused, tabActivated])
               .then(([, activatedTab]) => activatedTab);
}
