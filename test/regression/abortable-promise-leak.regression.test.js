// Documents a bug fixed by PR #139 — expected to FAIL on dev, passes once merged.

import { describe, it, expect, vi } from "vitest";
import { AbortablePromise } from "@/lib/abortable-promise";


it("removes its abort listener once the promise resolves, instead of leaking one per instance", async () => {
	const controller = new AbortController();
	const addSpy = vi.spyOn(controller.signal, "addEventListener");
	const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

	const instances = [
		new AbortablePromise(controller),
		new AbortablePromise(controller),
		new AbortablePromise(controller),
	];

	expect(addSpy).toHaveBeenCalledTimes(3);

	instances.forEach((instance, index) => instance.resolve(`value-${index}`));

	await Promise.all(instances);

		// on dev, the constructor's `signal.addEventListener("abort", () =>
		// this.resolve(...))` is never paired with a removeEventListener call
		// anywhere, so every resolved instance leaves its listener attached
		// to the shared controller's signal forever
	expect(removeSpy).toHaveBeenCalledTimes(3);
});
