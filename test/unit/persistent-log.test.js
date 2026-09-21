import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let log;
let flushLog;
let printLog;
let clearLog;


	// the log only writes when DEBUG is on, which error-handler.js normally sets
beforeEach(async () => {
	globalThis.DEBUG = true;
	vi.spyOn(console, "log").mockImplementation(() => {});
	({ default: log, flushLog, printLog, clearLog } =
		await import("@/background/persistent-log"));
	await clearLog();
	chrome.storage.local.get = vi.fn(chrome.storage.local.get);
	chrome.storage.local.set = vi.fn(chrome.storage.local.set);
});

afterEach(() => {
	vi.restoreAllMocks();
	globalThis.DEBUG = false;
});


describe("persistent-log", () => {
	it("writes a burst of entries in one storage round trip", async () => {
		log("first");
		log("second");
		log("third");

		await flushLog();

		expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);

		const entries = await printLog();

		expect(entries.map(({message}) => message))
			.toEqual(["first", "second", "third"]);
	});

	it("resolves the promise returned by log() once the batch is written", async () => {
		const logged = log("buffered");

		await flushLog();
		await logged;

		const entries = await printLog();

		expect(entries.at(-1).message).toBe("buffered");
	});

	it("drops buffered entries when the log is cleared", async () => {
		log("unwanted");
		await clearLog();
		await flushLog();

		expect(await printLog()).toEqual([]);
	});
});
