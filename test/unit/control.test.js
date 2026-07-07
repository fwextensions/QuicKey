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
});
