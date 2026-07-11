import { describe, it, expect, beforeEach, vi } from "vitest";

	// isHeld is module-level state in control.js, so each test re-imports the
	// module fresh.  navigator.locks itself is a single fake shared for the
	// whole file (installed once by test/setup.js), so each test that claims
	// the lock uses a lock name unique to that test.  otherwise a claim from
	// an earlier test that (by design, per below) never releases would still
	// be sitting in the fake's queue and starve a later test's claim.
function flush()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}


beforeEach(() => {
	vi.resetModules();
});


describe("control", () => {
	it("isHeld() is false before any claim", async () => {
		const control = (await import("@/shared/control")).default;

		expect(control.isHeld()).toBe(false);
	});

	it("claimWhenAvailable() acquires the lock and runs the task while it's held", async () => {
		const control = (await import("@/shared/control")).default;
		let heldDuringTask = false;
		const task = vi.fn(() => {
			heldDuringTask = control.isHeld();
		});

		control.claimWhenAvailable("control-test-acquire", task);
		await flush();

		expect(task).toHaveBeenCalledTimes(1);
		expect(heldDuringTask).toBe(true);
		expect(control.isHeld()).toBe(true);
	});

		// on dev, claimWhenAvailable() awaits the task and then, since the
		// (already-awaited) result is never itself a thenable, falls through
		// to `new Promise(() => {})`.  that promise never settles, so the
		// lock is held forever and a second claim on the same lock can never
		// be granted -- its task simply never runs.
	it("a second claimWhenAvailable() on the same lock never runs, since the first holds control forever", async () => {
		const control = (await import("@/shared/control")).default;
		const task1 = vi.fn(() => {});
		const task2 = vi.fn(() => {});
		const lockName = "control-test-serialize";

		control.claimWhenAvailable(lockName, task1);
		await flush();

		expect(task1).toHaveBeenCalledTimes(1);
		expect(control.isHeld()).toBe(true);

		control.claimWhenAvailable(lockName, task2);
		await flush();

		expect(task2).not.toHaveBeenCalled();
	});

		// the core of the worker/popup design: two separate contexts each have
		// their own control module (independent isHeld state) but share the
		// browser's single lock manager.  the worker takes control first; the
		// popup opens and queues behind it; when the worker is killed, the popup
		// must inherit control and run its setup task.  we model the two contexts
		// by importing control twice with a module reset in between, so each gets
		// its own instance, and simulate the worker dying with the locks fake's
		// _simulateContextLoss() (a task can't voluntarily release the lock on
		// the current code, so context death is the only hand-off path).
	it("hands control to a queued context when the current holder's context is lost", async () => {
		vi.resetModules();
		const workerControl = (await import("@/shared/control")).default;

		vi.resetModules();
		const popupControl = (await import("@/shared/control")).default;

			// sanity check that the two imports are genuinely independent
		expect(workerControl).not.toBe(popupControl);

		const lockName = "control-test-handoff";
		const workerTask = vi.fn(() => {});
		const popupTask = vi.fn(() => {});

			// the worker claims control at startup and holds it
		workerControl.claimWhenAvailable(lockName, workerTask);
		await flush();

		expect(workerControl.isHeld()).toBe(true);
		expect(workerTask).toHaveBeenCalledTimes(1);

			// the popup opens and queues behind the worker; it does not yet have
			// control, and its setup task must not run
		popupControl.claimWhenAvailable(lockName, popupTask);
		await flush();

		expect(popupControl.isHeld()).toBe(false);
		expect(popupTask).not.toHaveBeenCalled();

			// the service worker is killed, so the browser revokes its lock
		navigator.locks._simulateContextLoss(lockName);
		await flush();

			// the popup now holds control and runs its setup task
		expect(popupControl.isHeld()).toBe(true);
		expect(popupTask).toHaveBeenCalledTimes(1);
	});
});
