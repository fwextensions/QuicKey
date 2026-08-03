// Documents a bug in the storage layer's startup ordering — expected to FAIL
// before the initPromise barrier was added to doTask(), passes after.
//
// createStorage() has to return synchronously, so it kicks off initialize()
// and hangs onto the promise.  but doTask() used to read chrome.storage.local
// directly without ever waiting on that promise -- the dataPromise variable it
// stored was assigned three times and read zero times, a leftover from MV2,
// when the persistent background page could serve reads from an in-memory copy.
//
// background.js imports quickey-storage (starting initialize()) and then calls
// handleStartup() in the same module evaluation, which immediately calls
// storage.set() and destructures the data it's handed.  on a new install
// there's nothing on disk yet and initialize() hasn't finished writing the
// defaults, so that first task got undefined and threw, aborting the rest of
// the boot chain: no color scheme, no pageview, and no dispatchCachedEvents().
//
// these tests call createStorage() and then set()/get() with no await in
// between, which is the ordering background.js actually has.  going through the
// quickey-storage singleton instead wouldn't reproduce it: awaiting the dynamic
// import yields enough microtasks for initialize() to finish against the
// in-memory chrome fake, which the real chrome.storage.local IPC would not.

import { describe, it, expect, beforeEach } from "vitest";
import { createStorage } from "@/background/storage";

const Version = 3;


	// stands in for quickey-storage's getDefaultData, which queries all the
	// windows and tabs to tune the defaults before returning.  the await is the
	// point: initialize() can't finish writing within one microtask, exactly
	// like the real thing.
function makeDefaultData()
{
	return async () => {
		await chrome.tabs.query({});

		return {
			lastUsedVersion: "",
			colorScheme: "light",
			tabIDs: [],
			settings: { markTabsInOtherWindows: true },
		};
	};
}

function newStorage()
{
	return createStorage({
		name: "init-barrier-test",
		version: Version,
		getDefaultData: makeDefaultData(),
	});
}


beforeEach(async () => {
		// a brand-new install: nothing in chrome.storage.local yet
	await chrome.storage.local.clear();
});


describe("storage init barrier", () => {
		// the shape of background.js:260 -- handleStartup() runs in the same
		// module evaluation that started initialize(), so its set() lands while
		// the initial write is still in flight
	it("hands the defaults to a set() issued before initialize() finishes", async () => {
		const storage = newStorage();
		const seen = [];

		const result = await storage.set(data => {
			seen.push(data);

				// startup.js destructures the data it's given, which threw a
				// TypeError when this was undefined
			const {lastUsedVersion} = data;

			return lastUsedVersion !== "9.9.9"
				? { lastUsedVersion: "9.9.9" }
				: undefined;
		});

		expect(seen[0]).toBeDefined();
		expect(seen[0]).toHaveProperty("lastUsedVersion");
			// the defaults, not a bare object
		expect(seen[0].settings).toEqual({ markTabsInOtherWindows: true });

		expect(result.lastUsedVersion).toBe("9.9.9");
	});

		// same barrier for reads: recent-tabs and tabEventHandlers destructure
		// tabIDs out of a get() the same way
	it("hands the defaults to a get() issued before initialize() finishes", async () => {
		const storage = newStorage();

		const tabIDs = await storage.get(({tabIDs}) => tabIDs);

		expect(tabIDs).toEqual([]);
	});

		// the startup write must survive the reset that's still in flight
		// behind it, rather than being clobbered when it lands
	it("doesn't lose a startup write to the initial reset", async () => {
		const storage = newStorage();

		await storage.set(() => ({ lastUsedVersion: "9.9.9" }));

		const data = await storage.get();

		expect(data.lastUsedVersion).toBe("9.9.9");
			// and the defaults are still intact alongside it
		expect(data.settings).toEqual({ markTabsInOtherWindows: true });
		expect(await chrome.storage.local.get("version")).toEqual({ version: Version });
	});
});
