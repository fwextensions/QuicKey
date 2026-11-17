// Documents a bug fixed by PR #141 — expected to FAIL on dev, passes once merged.

import { describe, it, expect, beforeEach, vi } from "vitest";


beforeEach(() => {
	vi.resetModules();
});


it("replays an event that arrived while control wasn't held once control is claimed", async () => {
	const control = (await import("@/shared/control")).default;
	const { addListener } = await import("@/shared/controlledEvent");
	const handler = vi.fn();

	addListener("tabs.onActivated", handler);

	expect(control.isHeld()).toBe(false);

		// no context holds control yet, so this event should, per the fixed
		// behavior, be queued for replay rather than lost
	chrome.tabs.onActivated.dispatch({ tabId: 1 });

		// on dev, controlledEvent's wrapper drops the event outright because
		// control.isHeld() is false at dispatch time
	expect(handler).not.toHaveBeenCalled();

		// now a context takes control.  the task returns undefined, so per
		// control.js's current behavior isHeld becomes true and stays true
		// (the lock is held forever) -- that's fine here, we only need
		// isHeld() to flip to true after the claim
	control.claimWhenAvailable(() => {});
	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(control.isHeld()).toBe(true);

		// the dispatch above happened before any queuing/replay mechanism
		// existed on dev, so the handler is never invoked for it
	expect(handler).toHaveBeenCalledWith({ tabId: 1 });
});
