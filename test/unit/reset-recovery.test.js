import { describe, it, expect, vi } from "vitest";
import { createChromeFake } from "../support/chrome-fake";
import { createLocksFake } from "../support/locks-fake";

	// a reset caused by bad data shouldn't cost the user the settings they
	// tuned by hand.  the settings are kept only when they still pass the same
	// deep shape check validateUpdate() applies, so settings that are
	// themselves the problem get rebuilt along with everything else.
	//
	// this matters most for the markTabsInOtherWindows default, which is tuned
	// from the window count: a reset that runs during startup can see the
	// browser before the windows have been restored, and tune from a count
	// that's far too low.

const WindowsUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MarkTabsKey = "markTabsInOtherWindows";
	// one window, so the tuning would turn marking on if it ran
const Tabs = [
	{ id: 1, url: "https://a.example.com/", windowId: 1 },
	{ id: 2, url: "https://b.example.com/", windowId: 1, active: true },
];


function stubEnvironment()
{
	vi.resetModules();
	vi.stubGlobal("navigator", {
		userAgent: WindowsUA,
		platform: "Win32",
		languages: ["en-US"],
		locks: createLocksFake(),
	});
	vi.stubGlobal("chrome", createChromeFake({ tabs: Tabs }));
}


function flush()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}


async function loadStorage()
{
	await import("@/background/quickey-storage");

	for (let i = 0; i < 3; i++) {
		await flush();
	}

	return chrome.storage.local._dump();
}


	// install once to get a real, fully-shaped data object, then hand it back
	// to a fresh module over a fresh browser after letting the caller break it
async function resetFrom(
	corrupt)
{
	stubEnvironment();

	const installed = await loadStorage();

	expect(installed.data.settings[MarkTabsKey]).toBe(true);

		// turning it off is something only the user would have done, so it
		// surviving the reset can't be confused with the tuned default
	installed.data.settings[MarkTabsKey] = false;
	corrupt(installed.data);

	stubEnvironment();
	chrome.storage.local._seed({
		version: installed.version,
		data: installed.data,
		lastSavedFrom: "/popup.html",
	});

	return await loadStorage();
}


describe("recovery reset", () => {
		// the shape of the 4096-key corruption seen in the wild: the top level
		// is unrecognizable, but settings came through intact
	it("keeps settings whose shape still validates", async () => {
		const { data } = await resetFrom((data) => delete data.tabIDs);

			// the recents were rebuilt, so this really was a reset
		expect(data.tabIDs).toEqual([1, 2]);
		expect(data.settings[MarkTabsKey]).toBe(false);
	});


		// the profile isn't new just because we had to rebuild its recents
	it("keeps the original install time along with the settings", async () => {
		const installTime = 1500000000000;
		const { data } = await resetFrom((data) => {
			delete data.tabIDs;
			data.installTime = installTime;
		});

		expect(data.installTime).toBe(installTime);
	});


		// writing a bad value back would fail validation on the next startup
		// and reset all over again
	it("rebuilds an install time that isn't a date", async () => {
		const { data } = await resetFrom((data) => {
			delete data.tabIDs;
			data.installTime = null;
		});

			// the settings are still worth keeping even so
		expect(data.settings[MarkTabsKey]).toBe(false);
		expect(data.installTime).toBeTypeOf("number");
		expect(data.installTime).toBeGreaterThan(0);
	});


	it("rebuilds settings whose shape doesn't validate", async () => {
		const { data } = await resetFrom((data) => {
			delete data.tabIDs;
			delete data.settings.includeClosedTabs;
		});

		expect(data.tabIDs).toEqual([1, 2]);
		expect(data.settings[MarkTabsKey]).toBe(true);
		expect(data.settings.includeClosedTabs).toBe(true);
	});


		// a value of the wrong type is corruption too, not a user preference
	it("rebuilds settings holding a value of the wrong type", async () => {
		const { data } = await resetFrom((data) => {
			delete data.tabIDs;
			data.settings.includeClosedTabs = "true";
		});

		expect(data.settings[MarkTabsKey]).toBe(true);
		expect(data.settings.includeClosedTabs).toBe(true);
	});
});
