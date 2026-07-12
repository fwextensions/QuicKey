import * as k from "./constants";

	// the tail of the background's boot sequence: record the running version,
	// restore the toolbar icon for the last-seen color scheme, replay the
	// events sw.js cached while we were initializing, and react to how this
	// startup came about (fresh install, extension update, plain worker
	// wake-up).  extracted from background.js so the version-change behavior
	// is testable: the deps are what background.js passes, and the returned
	// promise settles when the whole chain has run.
export default function handleStartup({
	storage,
	toolbarIcon,
	tracker,
	installedPromise })
{
	let lastUsedVersion;

	return storage.set(data => {
			// save the lastUsedVersion in a global before we return the current
			// version below, so the onInstalled promise handler knows whether
			// to open the options page.  of course, to do that, we need to make
			// sure that promise is handled as part of the chain started from
			// getting the lastUsedVersion.  otherwise, the onInstalled promise
			// below would always think it was being updated.
		({lastUsedVersion} = data);

			// set which icon to show in the toolbar based on the color scheme that
			// we saw the last time we were run.  if it's changed since then, we'll
			// need to wait for the popup or menu to open to update the icon, but
			// most of the time the last seen scheme is a reasonable default.
		toolbarIcon.setColorScheme(data.colorScheme);

			// returning undefined tells storage.set() to skip writing, so we
			// only pay for a full storage write when the version has changed
		return lastUsedVersion !== k.Version
			? { lastUsedVersion: k.Version }
			: undefined;
	})
		.then(() => {
			tracker.pageview();
			tracker.timing("loading", "background-loaded", performance.now());

				// now that everything is set up, fire all the cached events
			globalThis.dispatchCachedEvents();
DEBUG && console.log("%c%s", "background: darkgreen; color: white;", "====== startup done ======", performance.now());
		})
			// pause the chain to wait for the installed promise to resolve,
			// which it will never do if the event doesn't fire.  if it does,
			// it should do so before we get here, but we use a promise just
			// in case it doesn't for some reason.
		.then(() => installedPromise)
		.then(({reason, previousVersion}) => {
			tracker.event("extension", reason, previousVersion);

			if (reason === "update" && lastUsedVersion.startsWith("1.8")) {
					// open the options page with an update message about the new
					// popup window options
				chrome.tabs.create({
					url: chrome.runtime.getURL("options.html#/popup?welcome-v2")
				});
				tracker.event("extension", "open-options");
			}
		})
		.catch(error => tracker.exception(error));
}
