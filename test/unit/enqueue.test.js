import { describe, it, expect, vi } from "vitest";
import { enqueue } from "@/shared/enqueue";

	// the command queues in commandHandlers used to chain with then() and
	// finally() directly.  one rejection left the tail rejected for good: every
	// later toggle skipped its handlers, and every previous/next re-reported
	// the same error.


describe("enqueue()", () => {
	it("runs tasks in order, each after the previous one settles", async () => {
		const order = [];
		let tail = Promise.resolve();

		tail = enqueue(tail, async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			order.push(1);
		}, vi.fn());
		tail = enqueue(tail, () => order.push(2), vi.fn());

		await tail;

		expect(order).toEqual([1, 2]);
	});

	it("keeps running later tasks after one rejects", async () => {
		const next = vi.fn();
		let tail = Promise.resolve();

		tail = enqueue(tail, () => { throw new Error("boom"); }, vi.fn());
		tail = enqueue(tail, next, vi.fn());

		await tail;

		expect(next).toHaveBeenCalledTimes(1);
	});

	it("reports a failure once, and not again from later tasks", async () => {
		const error = new Error("boom");
		const firstOnError = vi.fn();
		const laterOnError = vi.fn();
		let tail = Promise.resolve();

		tail = enqueue(tail, () => Promise.reject(error), firstOnError);
		tail = enqueue(tail, () => {}, laterOnError);
		tail = enqueue(tail, () => {}, laterOnError);

		await tail;

		expect(firstOnError).toHaveBeenCalledExactlyOnceWith(error);
		expect(laterOnError).not.toHaveBeenCalled();
	});
});
