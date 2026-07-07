// Documents a bug fixed by PR #141 — expected to FAIL on dev, passes once merged.

import { describe, it, expect, beforeEach, vi } from "vitest";


beforeEach(() => {
	vi.resetModules();
});


it("releases control once a promise-returning task settles", async () => {
	const control = (await import("@/shared/control")).default;

	const claimPromise = control.claimWhenAvailable(() => Promise.resolve("done"));

		// on dev, claimWhenAvailable() does `const result = await task()`, so
		// by the time it checks `typeof result?.then === "function"`, the
		// promise the task returned has already been unwrapped to "done" --
		// a plain string is never a thenable, so it falls through to
		// `new Promise(() => {})` and holds the lock forever.  race against a
		// timeout so a failure here is fast and diagnostic rather than a hang.
	const timeout = new Promise((resolve, reject) =>
		setTimeout(() => reject(new Error(
			"claimWhenAvailable() never resolved -- control is stuck held forever")), 200));

	const result = await Promise.race([claimPromise, timeout]);

	expect(result).toBe("done");
	expect(control.isHeld()).toBe(false);
});
