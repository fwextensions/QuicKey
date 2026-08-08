import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStorage } from "@/background/storage";

	// createStorage() kicks off initialize() without awaiting it, since it has
	// to return the storage object synchronously.  get()/set() block on it
	// internally, so a test doesn't have to flush before driving them -- see
	// the storage-init-barrier regression test for what happens when they
	// don't.  the flush is kept where a test wants to assert on what
	// initialize() itself wrote, before any task runs.
function flush()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}


beforeEach(() => {
	chrome.storage.local.clear();
	vi.restoreAllMocks();
});


describe("storage get()/set()", () => {
	it("get() returns the stored data, and set() merges a partial result and persists it", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { foo: "bar", count: 1 },
			lastSavedFrom: "/other.html",
		});

		const storage = createStorage({ name: "get-set", version: 1 });

		await flush();

		const data = await storage.get();

		expect(data).toEqual({ foo: "bar", count: 1 });

		await storage.set(() => ({ count: 2 }));

		const dump = chrome.storage.local._dump();

		expect(dump.data).toEqual({ foo: "bar", count: 2 });
	});

	it("a task that returns nothing saves no changes", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { foo: "bar" },
			lastSavedFrom: "/other.html",
		});

		const storage = createStorage({ name: "noop-set", version: 1 });

		await flush();
		await storage.set(() => undefined);

		expect(chrome.storage.local._dump().data).toEqual({ foo: "bar" });
	});
});


describe("storage locking", () => {
	it("serializes two concurrent set() calls under the storage lock without losing either update", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { a: 0, b: 0 },
			lastSavedFrom: "/x.html",
		});

		const storage = createStorage({ name: "concurrent", version: 1 });

		await flush();

		const order = [];

		const task1 = storage.set(async (data) => {
			order.push("task1-start");
			await new Promise((resolve) => setTimeout(resolve, 10));
			order.push("task1-end");

			return { a: data.a + 1 };
		});

		const task2 = storage.set(async (data) => {
			order.push("task2-start");

			return { b: data.b + 1 };
		});

		await Promise.all([task1, task2]);

			// task2 must not have started until task1's lock-held callback
			// resolved, proving the two sets were serialized
		expect(order).toEqual(["task1-start", "task1-end", "task2-start"]);
		expect(chrome.storage.local._dump().data).toEqual({ a: 1, b: 1 });
	});
});


describe("storage versioning", () => {
	it("runs the updater chain when seeded data is below the current version", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { name: "old" },
			lastSavedFrom: "/x.html",
		});

		const storage = createStorage({
			name: "migrate",
			version: 3,
			updaters: {
				1: (data) => [{ ...data, step: "v2" }, 2],
				2: (data) => [{ ...data, step: "v3" }, 3],
			},
		});

		await flush();

		const data = await storage.get();

		expect(data).toEqual({ name: "old", step: "v3" });
		expect(chrome.storage.local._dump().version).toBe(3);
	});

	it("resets to getDefaultData when validateUpdate rejects the data as invalid", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { corrupt: true },
			lastSavedFrom: "/x.html",
		});

		const storage = createStorage({
			name: "invalid",
			version: 1,
			validateUpdate: () => Promise.resolve(false),
			getDefaultData: () => Promise.resolve({ fresh: true }),
		});

		await flush();

		const data = await storage.get();

		expect(data).toEqual({ fresh: true });
	});

		// validateUpdate() only runs after the updaters, so data that isn't an
		// object has to survive them to reach the check that would reset it.
		// an updater that throws on it never resets at all -- it wedges the
		// storage behind a failed-init that retries forever
	it("resets rather than handing the updaters data that isn't an object", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: "}{ truncated json",
			lastSavedFrom: "/x.html",
		});

		const updater = vi.fn((data) => [{ ...data, migrated: true }, 2]);
		const storage = createStorage({
			name: "precheck",
			version: 2,
			updaters: { 1: updater },
			getDefaultData: () => Promise.resolve({ fresh: true }),
		});

		await flush();

		expect(updater).not.toHaveBeenCalled();
		expect(await storage.get()).toEqual({ fresh: true });
	});


		// addDefaultSetting() writes straight into data.settings
	it("resets when settings isn't an object the updaters can write into", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { settings: "gone" },
			lastSavedFrom: "/x.html",
		});

		const updater = vi.fn((data) => [{ ...data, migrated: true }, 2]);
		const storage = createStorage({
			name: "precheck-settings",
			version: 2,
			updaters: { 1: updater },
			getDefaultData: () => Promise.resolve({ fresh: true }),
		});

		await flush();

		expect(updater).not.toHaveBeenCalled();
		expect(await storage.get()).toEqual({ fresh: true });
	});


		// the check can't look at the shape, since changing the shape is what
		// the updaters are for: old data legitimately lacks keys the current
		// version has, and carries keys it doesn't
	it("still updates old data whose shape doesn't match the current version", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { name: "old", goingAway: true },
			lastSavedFrom: "/x.html",
		});

		const storage = createStorage({
			name: "precheck-old-shape",
			version: 2,
			updaters: {
				1: ({goingAway, ...data}) => [{ ...data, settings: { added: true } }, 2],
			},
			getDefaultData: () => Promise.resolve({ fresh: true }),
		});

		await flush();

		expect(await storage.get()).toEqual({ name: "old", settings: { added: true } });
	});


		// a reset triggered by bad data isn't a new install, and the data it's
		// replacing may still hold parts worth keeping, so getDefaultData() is
		// given the chance to salvage them
	it("hands the rejected data to getDefaultData on a recovery reset", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { corrupt: true, worthKeeping: "mine" },
			lastSavedFrom: "/x.html",
		});

		const getDefaultData = vi.fn((previousData) => Promise.resolve({
			fresh: true,
			worthKeeping: previousData?.worthKeeping ?? "default",
		}));
		const storage = createStorage({
			name: "recovery",
			version: 1,
			validateUpdate: () => Promise.resolve(false),
			getDefaultData,
		});

		await flush();

		expect(await storage.get()).toEqual({ fresh: true, worthKeeping: "mine" });
	});


		// asking for a reset is asking for a clean slate, not a recovery
	it("hands nothing to getDefaultData on an explicit reset", async () => {
		chrome.storage.local._seed({
			version: 1,
			data: { worthKeeping: "mine" },
			lastSavedFrom: "/x.html",
		});

		const getDefaultData = vi.fn((previousData) => Promise.resolve({
			worthKeeping: previousData?.worthKeeping ?? "default",
		}));
		const storage = createStorage({ name: "explicit-reset", version: 1, getDefaultData });

		await flush();
		await storage.reset();

		expect(getDefaultData).toHaveBeenCalledWith(undefined);
		expect(await storage.get()).toEqual({ worthKeeping: "default" });
	});


	it("resets to getDefaultData on a fresh install with no stored data", async () => {
		const storage = createStorage({
			name: "fresh-install",
			version: 1,
			getDefaultData: () => Promise.resolve({ isNew: true }),
		});

		await flush();

		const data = await storage.get();

		expect(data).toEqual({ isNew: true });
		expect(chrome.storage.local._dump().version).toBe(1);
	});
});


	// the storage APIs can fail for reasons that aren't our doing and don't
	// necessarily persist -- a full disk is the one that shows up in the wild.
	// a task must not run against no data, but the worker is short-lived enough
	// that staying broken for its whole lifetime would be worse than retrying.
describe("storage init failure", () => {
	it("rejects a task instead of running it against no data", async () => {
		vi.spyOn(chrome.storage.local, "get").mockRejectedValueOnce(
			new Error("IO error: FILE_ERROR_NO_SPACE"));

		const storage = createStorage({ name: "init-fails", version: 1 });
		const task = vi.fn();

		await expect(storage.get(task)).rejects.toThrow("FILE_ERROR_NO_SPACE");
		expect(task).not.toHaveBeenCalled();
	});

	it("retries the init on the next task after a failure", async () => {
		vi.spyOn(chrome.storage.local, "get").mockRejectedValueOnce(
			new Error("IO error: FILE_ERROR_NO_SPACE"));

		const storage = createStorage({
			name: "init-retries",
			version: 1,
			getDefaultData: () => Promise.resolve({ isNew: true }),
		});

		await expect(storage.get()).rejects.toThrow("FILE_ERROR_NO_SPACE");

			// the mock only rejected once, so the disk is "better" now
		const data = await storage.get();

		expect(data).toEqual({ isNew: true });
		expect(chrome.storage.local._dump().version).toBe(1);
	});

		// nothing awaits the eager init kicked off by createStorage(), so it
		// has to swallow its own rejection or a failed load takes down the
		// worker as an unhandled rejection before any task can report it
	it("doesn't leave the eager init as an unhandled rejection", async () => {
		const unhandled = vi.fn();

		process.on("unhandledRejection", unhandled);

		try {
			vi.spyOn(chrome.storage.local, "get").mockRejectedValueOnce(
				new Error("IO error: FILE_ERROR_NO_SPACE"));

			createStorage({ name: "init-unhandled", version: 1 });

				// two macrotasks: one for the rejection to settle, one for node
				// to decide nothing handled it
			await flush();
			await flush();

			expect(unhandled).not.toHaveBeenCalled();
		} finally {
			process.off("unhandledRejection", unhandled);
		}
	});
});
