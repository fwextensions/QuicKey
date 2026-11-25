import { describe, it, expect, beforeEach, vi } from "vitest";
import { activateTab } from "@/popup/activate-tab";

       // the toolbar menu is an action popup, which Chrome closes, destroying its
       // page, as soon as focusing a browser window takes focus away from it.  any
       // chrome call queued behind an await of windows.update() never gets sent,
       // so selecting a tab just closed the menu (issues #170 and #173).  both
       // calls have to be dispatched synchronously, before the first await.
describe("activateTab", () => {
       let windowsUpdate;
       let tabsUpdate;

       beforeEach(() => {
                       // windows.update() never settles, as if the page died mid-await
               windowsUpdate = vi.spyOn(chrome.windows, "update")
                       .mockImplementation(() => new Promise(() => {}));
               tabsUpdate = vi.spyOn(chrome.tabs, "update")
                       .mockImplementation((id, props) => Promise.resolve({ id, ...props }));
       });

       it("dispatches both the window focus and tab activation synchronously", () => {
               activateTab({ id: 7, windowId: 3 });

               expect(windowsUpdate).toHaveBeenCalledWith(3, { focused: true });
               expect(tabsUpdate).toHaveBeenCalledWith(7, { active: true });
       });

       it("focuses the window before activating the tab", () => {
               activateTab({ id: 7, windowId: 3 });

               expect(windowsUpdate.mock.invocationCallOrder[0])
                       .toBeLessThan(tabsUpdate.mock.invocationCallOrder[0]);
       });

       it("passes extra options, like an unsuspend URL, to tabs.update()", () => {
               activateTab({ id: 7, windowId: 3 }, { url: "https://example.com/" });

               expect(tabsUpdate).toHaveBeenCalledWith(7, { active: true, url: "https://example.com/" });
       });

       it("resolves to the updated tab", async () => {
               windowsUpdate.mockResolvedValue({ id: 3 });

               await expect(activateTab({ id: 7, windowId: 3 })).resolves.toEqual({ id: 7, active: true });
       });
});