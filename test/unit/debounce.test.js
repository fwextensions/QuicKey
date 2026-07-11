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

	it("execute() invokes immediately when a call is pending and resolves with func's result", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 1000);

		debounced(21);
		expect(func).not.toHaveBeenCalled();

		const result = debounced.execute();

		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith(21);
		await expect(result).resolves.toBe(42);

			// the pending timeout was cleared by exec(), so advancing past the
			// original wait must not call func a second time
		vi.advanceTimersByTime(1000);
		expect(func).toHaveBeenCalledTimes(1);
	});

	it("execute() with nothing pending and no waitForNext resolves to null", async () => {
		const func = vi.fn();
		const debounced = debounce(func, 100);

		const result = debounced.execute();

		expect(func).not.toHaveBeenCalled();
		await expect(result).resolves.toBe(null);
	});

	it("execute(true) with nothing pending waits for, and forces, the next call to fire immediately", async () => {
		const func = vi.fn((x) => x * 2);
		const debounced = debounce(func, 1000);

		const waiting = debounced.execute(true);

		expect(func).not.toHaveBeenCalled();

			// this call should fire right away instead of waiting out `wait`,
			// because execute(true) left a resolver in waitingResolvers
		debounced(21);

		expect(func).toHaveBeenCalledTimes(1);
		expect(func).toHaveBeenCalledWith(21);
		await expect(waiting).resolves.toBe(42);
	});
});
