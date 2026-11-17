import { describe, it, expect } from "vitest";

	// a minimal harness sanity check: prove the chrome / navigator / locks fakes
	// and the alias resolution let the critical source modules import and their
	// import-time chrome calls (constants' top-level awaits, createStorage's
	// initialize()) resolve without throwing.  the real behavior tests live in
	// the sibling files.

describe("harness smoke test", () => {
	it("exposes the fake globals", () => {
		expect(typeof chrome.storage.local.get).toBe("function");
		expect(typeof navigator.locks.request).toBe("function");
		expect(DEBUG).toBe(false);
	});

	it("imports the storage factory", async () => {
		const { createStorage } = await import("@/background/storage");

		expect(typeof createStorage).toBe("function");
	});

	it("imports recent-tabs with the analytics trackers mocked", async () => {
		const recentTabs = (await import("@/background/recent-tabs")).default;

		expect(typeof recentTabs.add).toBe("function");
		expect(typeof recentTabs.navigate).toBe("function");
	});

	it("imports the shared control module", async () => {
		const control = (await import("@/shared/control")).default;

		expect(typeof control.claimWhenAvailable).toBe("function");
		expect(control.isHeld()).toBe(false);
	});
});
