import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { debounce } from "@/background/debounce";


describe("debounce", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("calls func once after the wait, collapsing rapid calls to the latest args", () => {
		const func = vi.fn();
		const debounced = debounce(func, 100);

		debounced(1);
		debounced(2);
		debounced(3);

		expect(func).not.toHaveBeenCalled();

		vi.advanceTimersByTime(99);
		expect(func).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith(3);
	});

	it("restarts the wait timer on every call", () => {
		const func = vi.fn();
		const debounced = debounce(func, 100);

		debounced("a");
		vi.advanceTimersByTime(60);
		debounced("b");
		vi.advanceTimersByTime(60);

			// the second call reset the timer, so only 60ms have passed since it
		expect(func).not.toHaveBeenCalled();

		vi.advanceTimersByTime(40);
		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith("b");
	});

	it("cancel() prevents a pending invocation", () => {
		const func = vi.fn();
		const debounced = debounce(func, 100);

		debounced("a");
		debounced.cancel();
		vi.advanceTimersByTime(100);

		expect(func).not.toHaveBeenCalled();
	});

	it("flush() invokes immediately when a call is pending and resolves with func's result", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 1000);

		debounced(21);
		expect(func).not.toHaveBeenCalled();

		const result = debounced.flush();

		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith(21);
		await expect(result).resolves.toBe(42);

			// the pending timeout was cleared by the call, so advancing past the
			// original wait must not call func a second time
		vi.advanceTimersByTime(1000);
		expect(func).toHaveBeenCalledTimes(1);
	});

	it("flush() with nothing pending resolves to undefined without calling func", async () => {
		const func = vi.fn();
		const debounced = debounce(func, 100);

		const result = debounced.flush();

		expect(func).not.toHaveBeenCalled();
		await expect(result).resolves.toBeUndefined();
	});

	it("flush() only fires the pending call once", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 100);

		debounced(21);

		await expect(debounced.flush()).resolves.toBe(42);
		await expect(debounced.flush()).resolves.toBeUndefined();

		expect(func).toHaveBeenCalledTimes(1);
	});

	it("flushOrNext() flushes a pending call like flush() does", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 1000);

		debounced(21);

		await expect(debounced.flushOrNext()).resolves.toBe(42);
		expect(func).toHaveBeenCalledTimes(1);
	});

	it("flushOrNext() with nothing pending waits for, and forces, the next call to fire immediately", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 1000);

		const waiting = debounced.flushOrNext();

		expect(func).not.toHaveBeenCalled();

			// this call should fire right away instead of waiting out `wait`,
			// because flushOrNext() left a resolver in waitingResolvers
		debounced(21);

		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith(21);
		await expect(waiting).resolves.toBe(42);
	});

		// otherwise anything awaiting a call that's been cancelled out from
		// under it stays pending for the life of the worker
	it("cancel() settles a promise left waiting by flushOrNext()", async () => {
		const func = vi.fn();
		const debounced = debounce(func, 100);

		const waiting = debounced.flushOrNext();

		debounced.cancel();

		await expect(waiting).resolves.toBeUndefined();
		expect(func).not.toHaveBeenCalled();
	});

	it("now() calls func immediately with its own args", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 1000);

		const result = debounced.now(21);

		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith(21);
		await expect(result).resolves.toBe(42);
	});

	it("now() supersedes a scheduled call rather than adding to it", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 100);

		debounced(1);

		await expect(debounced.now(21)).resolves.toBe(42);

		vi.advanceTimersByTime(100);

			// the scheduled call was dropped, not run after ours
		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith(21);
	});

		// now() counts as the call flushOrNext() was waiting for
	it("now() settles a promise left waiting by flushOrNext()", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 1000);

		const waiting = debounced.flushOrNext();

		debounced.now(21);

		await expect(waiting).resolves.toBe(42);
		expect(func).toHaveBeenCalledTimes(1);
	});

	it("awaits an async func through now() and flush()", async () => {
		const func = vi.fn(async (x) => x * 2);
		const debounced = debounce(func, 100);

		await expect(debounced.now(21)).resolves.toBe(42);

		debounced(50);
		await expect(debounced.flush()).resolves.toBe(100);
	});
});
