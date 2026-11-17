	// a harness for standing up multiple extension contexts (the service
	// worker, the popup) inside one test.  each context is a fresh module
	// graph (vi.resetModules) tagged with its own location.pathname, while the
	// chrome fake and navigator.locks stay shared -- exactly the production
	// topology, where separate JS contexts talk to one browser.
	//
	// destroyContext() models MV3 killing a context: the listeners that
	// context registered on the chrome event hubs are detached, and the
	// browser revokes its "__control__" web lock so the next queued context
	// inherits control.  ownership of listeners is inferred from snapshots of
	// the hubs taken when each context is created, so contexts must be created
	// (and finish their async setup) in order -- create a context, flush its
	// startup promises, then create the next.  a context that keeps adding
	// chrome listeners after a later context was created would be mis-tagged;
	// none of the code under test does that.

import { vi } from "vitest";
import { createChromeFake } from "./chrome-fake";
import { createLocksFake } from "./locks-fake";

const ControlLockName = "__control__";

	// contexts created since the last resetContexts(), in creation order
let contexts = [];

	// find every event hub reachable from the chrome fake (objects that expose
	// addListener plus the fake's _listeners helper)
function collectHubs(
	root,
	hubs = [],
	seen = new Set())
{
	for (const value of Object.values(root)) {
		if (value && typeof value === "object" && !seen.has(value)) {
			seen.add(value);

			if (typeof value.addListener === "function"
					&& typeof value._listeners === "function") {
				hubs.push(value);
			} else {
				collectHubs(value, hubs, seen);
			}
		}
	}

	return hubs;
}

function snapshotHubs()
{
	return new Map(collectHubs(chrome).map((hub) => [hub, new Set(hub._listeners())]));
}


	// install a fresh chrome fake and locks fake, and forget any contexts from
	// the previous test.  module graphs left over from an earlier test still
	// reference the *old* fakes, so their leftover listeners and held locks
	// can't leak into this test.  call from beforeEach, before createContext().
export function resetContexts(
	chromeOptions = {})
{
	vi.resetModules();
	vi.stubGlobal("chrome", createChromeFake(chromeOptions));
	navigator.locks = createLocksFake();
	contexts = [];
}


	// create a context: reset the module registry, point location at pathname,
	// snapshot the chrome event hubs, then run loader() (which does the
	// dynamic imports and any init calls) and return its result alongside a
	// destroy() that simulates this context being killed.
export async function createContext(
	pathname,
	loader)
{
	vi.resetModules();
	vi.stubGlobal("location", {
		pathname,
		href: `chrome-extension://quickeyfakeextensionidaaaaaaaaaa${pathname}`,
		search: "",
	});

	const context = {
		pathname,
		snapshot: snapshotHubs(),
		destroyed: false,
	};

	contexts.push(context);

	const modules = await loader();

	return {
		pathname,
		modules,

			// kill this context: detach the chrome listeners it added, then
			// (for the context that holds control -- pass releaseControl: false
			// when destroying a context that was only queued) have the browser
			// revoke its control lock so the next waiter inherits it
		destroy({ releaseControl = true } = {}) {
			if (context.destroyed) {
				return;
			}

			context.destroyed = true;

				// this context's listeners are the ones present in the next
				// context's creation snapshot (or present right now, if this is
				// the newest context) but absent from its own creation snapshot
			const index = contexts.indexOf(context);
			const next = contexts[index + 1];
			const after = next ? next.snapshot : snapshotHubs();

			for (const [hub, listeners] of after) {
				const before = context.snapshot.get(hub) ?? new Set();

				for (const listener of listeners) {
					if (!before.has(listener)) {
						hub.removeListener(listener);
					}
				}
			}

			if (releaseControl) {
				navigator.locks._simulateContextLoss(ControlLockName);
			}
		},
	};
}
