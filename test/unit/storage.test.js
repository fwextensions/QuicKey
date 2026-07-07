import { describe, it, expect, beforeEach } from "vitest";
import { createStorage } from "@/background/storage";

	// createStorage() kicks off initialize() synchronously and unawaited:
	// it reads chrome.storage.local directly (outside the storage lock) and,
	// since our seeded version always matches the requested version and the
	// default validateUpdate always passes, ends up re-saving the same data
	// right away.  flushing a real macrotask lets that settle before a test
	// drives get()/set() through the lock, so the two don't race.
function flush()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}


beforeEach(() => {
	chrome.storage.local.clear();
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
