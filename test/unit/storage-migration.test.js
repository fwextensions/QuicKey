import { describe, it, expect, beforeEach, vi } from "vitest";
import fixtures from "../fixtures/storage-versions";

	// upgrade coverage for the real quickey-storage module: era-accurate
	// fixtures of old stored data (see test/fixtures/storage-versions.js) are
	// seeded into the chrome fake, the module is imported fresh so its
	// unawaited initialize() runs the updater chain, and the result must be
	// exactly the shape a fresh install produces -- with the user's data
	// still in it.  a failed or incomplete migration is worse than a crash:
	// validateUpdate() responds by silently resetting the user's storage.
	//
	// the shape assertions compare against an actual fresh install performed
	// through the same public path, so these tests don't hardcode the
	// current storage version and keep working as updaters are added -- as
	// long as each new default key ships with an updater, which is exactly
	// the regression this file exists to catch.

function flush()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}

	// import a fresh instance of the storage singleton and let its unawaited
	// initialize() -> update()/reset chain settle
async function importStorage()
{
	vi.resetModules();

	const storage = (await import("@/background/quickey-storage")).default;

	for (let i = 0; i < 3; i++) {
		await flush();
	}

	return storage;
}

	// what a brand-new install writes, via the same public path the
	// migration tests use; the baseline for version and shape assertions
async function freshInstall()
{
	await chrome.storage.local.clear();
	await importStorage();

	return chrome.storage.local._dump();
}

function seedVersion(
	version,
	data)
{
	chrome.storage.local._seed({
		version,
		data: structuredClone(data),
		lastSavedFrom: "/popup.html",
	});
}

function expectSameShape(
	migrated,
	fresh)
{
	expect(Object.keys(migrated).sort()).toEqual(Object.keys(fresh).sort());
	expect(Object.keys(migrated.settings).sort()).toEqual(Object.keys(fresh.settings).sort());
	expect(Object.keys(migrated.settings.shortcuts.win).sort())
		.toEqual(Object.keys(fresh.settings.shortcuts.win).sort());
}


beforeEach(() => {
	delete globalThis.FAILED_STORAGE;
});


describe("storage migration from historical versions", () => {
	it("migrates version 3 (pre-settings era) to the current version, preserving recents", async () => {
		const fresh = await freshInstall();

		seedVersion(3, fixtures[3]);
		await importStorage();

		const { version, data } = chrome.storage.local._dump();

		expect(version).toBe(fresh.version);
		expectSameShape(data, fresh.data);

			// the user's recents survived -- a reset would have emptied them
		expect(data.tabIDs).toEqual([101, 102]);
		expect(data.tabsByID[101].url).toBe("https://one.example.com/");

			// updater 3's explicit changes
		expect(data.switchFromShortcut).toBeUndefined();
		expect(data.lastShortcutTabID).toBeUndefined();
		expect(data.installTime).toBeTypeOf("number");

			// profiles that predate options-page versioning start at 7, so
			// they're shown what's new since then
		expect(data.lastSeenOptionsVersion).toBe(7);
	});

	it("migrates version 4, filling in settings from the live defaults", async () => {
		const fresh = await freshInstall();

		seedVersion(4, fixtures[4]);
		await importStorage();

		const { version, data } = chrome.storage.local._dump();

		expect(version).toBe(fresh.version);
		expectSameShape(data, fresh.data);
		expect(data.tabIDs).toEqual([101, 102]);
		expect(data.installTime).toBe(fixtures[4].installTime);
	});

	it("migrates version 6 (early settings era), preserving customized settings", async () => {
		const fresh = await freshInstall();

		seedVersion(6, fixtures[6]);
		await importStorage();

		const { version, data } = chrome.storage.local._dump();

		expect(version).toBe(fresh.version);
		expectSameShape(data, fresh.data);

			// customizations from 2018 must not be clobbered by defaults
		expect(data.settings.escBehavior).toBe("close");
		expect(data.settings.includeClosedTabs).toBe(false);
		expect(data.settings.shortcuts.win.mruSelect).toBe("e");
		expect(data.lastUsedVersion).toBe("1.1.2");
	});

	it("migrates version 13 to the current version (schema-drift guard)", async () => {
			// if this one fails after you add a key to createDefaultData() or
			// to the default settings, you're missing an updater for it --
			// existing profiles would fail validation and be silently reset
		const fresh = await freshInstall();

		seedVersion(13, fixtures[13]);
		await importStorage();

		const { version, data } = chrome.storage.local._dump();

		expect(version).toBe(fresh.version);
		expectSameShape(data, fresh.data);
		expect(data.colorScheme).toBe("light");
		expect(data.lastQuery).toBe("docs");
		expect(data.settings.showTabCount).toBe(true);
		expect(data.lastSeenOptionsVersion).toBe(7);
	});
});


describe("storage migration failure paths", () => {
	it("resets to defaults and keeps the bad blob in FAILED_STORAGE when validation fails", async () => {
		const fresh = await freshInstall();

		seedVersion(fresh.version, { garbage: true });
		await importStorage();

		const { version, data } = chrome.storage.local._dump();

		expect(version).toBe(fresh.version);
		expectSameShape(data, fresh.data);
		expect(data.tabIDs).toEqual([]);

			// the unsalvageable data is parked globally for devtools recovery
		expect(globalThis.FAILED_STORAGE).toMatchObject({
			version: fresh.version,
			data: { garbage: true },
		});
	});

	it("resets when the stored version predates the oldest updater", async () => {
		const fresh = await freshInstall();

		seedVersion(2, fixtures[3]);
		await importStorage();

		const { version, data } = chrome.storage.local._dump();

		expect(version).toBe(fresh.version);
		expectSameShape(data, fresh.data);
		expect(data.tabIDs).toEqual([]);
		expect(globalThis.FAILED_STORAGE).toMatchObject({ version: 2 });
	});
});


describe("startup with current-version storage", () => {
	it("does not rewrite storage when the data is already at the current version", async () => {
		const fresh = await freshInstall();
		const data = structuredClone(fresh.data);

		data.lastQuery = "marker";
		seedVersion(fresh.version, data);
		await importStorage();

		const dump = chrome.storage.local._dump();

			// lastSavedFrom still names the seeder: startup didn't write
		expect(dump.lastSavedFrom).toBe("/popup.html");
		expect(dump.data.lastQuery).toBe("marker");
	});
});
