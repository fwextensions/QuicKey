import { describe, it, expect, beforeEach, vi } from "vitest";
import handleStartup from "@/background/startup";

	// the boot-tail behavior extracted from background.js: recording the
	// running version (only when it changed), restoring the toolbar icon's
	// color scheme, replaying sw.js's cached events, and deciding -- from the
	// onInstalled reason plus the version the user last ran -- whether to
	// open the options page with the v2 welcome message.

	// k.Version comes from the fake manifest
const CurrentVersion = "2.0.2";


function makeDeps({
	lastUsedVersion,
	installedWith } = {})
{
	const data = { lastUsedVersion, colorScheme: "dark" };
	const writes = [];

	return {
		data,
		writes,
		deps: {
			storage: {
				set: async (task) => {
					const result = await task(data);

					if (result) {
						Object.assign(data, result);
						writes.push(result);
					}

					return data;
				},
			},
			toolbarIcon: { setColorScheme: vi.fn() },
			tracker: {
				pageview: vi.fn(),
				timing: vi.fn(),
				event: vi.fn(),
				exception: vi.fn(),
			},
				// no argument: model the wake-up case, where onInstalled never
				// fires and the promise stays pending forever
			installedPromise: installedWith
				? Promise.resolve(installedWith)
				: new Promise(() => {}),
		},
	};
}

function flush()
{
	return new Promise((resolve) => setTimeout(resolve, 0));
}


beforeEach(() => {
		// vi.spyOn() reuses the existing spy (and its call history) when the
		// same method is spied twice, so restore between tests
	vi.restoreAllMocks();
	globalThis.dispatchCachedEvents = vi.fn();
});


describe("startup", () => {
	it("on first install, records the running version and tracks the install", async () => {
		const { deps, writes } = makeDeps({
			lastUsedVersion: "",
			installedWith: { reason: "install" },
		});

		await handleStartup(deps);

		expect(writes).toEqual([{ lastUsedVersion: CurrentVersion }]);
		expect(deps.toolbarIcon.setColorScheme).toHaveBeenCalledWith("dark");
		expect(globalThis.dispatchCachedEvents).toHaveBeenCalledTimes(1);
		expect(deps.tracker.event).toHaveBeenCalledWith("extension", "install", undefined);
	});

	it("on a plain worker wake-up, skips the storage write but still replays cached events", async () => {
		const { deps, writes } = makeDeps({ lastUsedVersion: CurrentVersion });

		handleStartup(deps);
		await flush();

			// the version didn't change, so startup must not rewrite storage --
			// this runs on every worker cold start
		expect(writes).toEqual([]);
		expect(globalThis.dispatchCachedEvents).toHaveBeenCalledTimes(1);
		expect(deps.tracker.event).not.toHaveBeenCalled();
	});

	it("opens the options page with the welcome message when updating from 1.8", async () => {
		const { deps, writes } = makeDeps({
			lastUsedVersion: "1.8.4",
			installedWith: { reason: "update", previousVersion: "1.8.4" },
		});
		const createTab = vi.spyOn(chrome.tabs, "create");

		await handleStartup(deps);

		expect(writes).toEqual([{ lastUsedVersion: CurrentVersion }]);
		expect(createTab).toHaveBeenCalledExactlyOnceWith({
			url: `chrome-extension://${chrome.runtime.id}/options.html#/popup?welcome-v2`,
		});
		expect(deps.tracker.event).toHaveBeenCalledWith("extension", "update", "1.8.4");
		expect(deps.tracker.event).toHaveBeenCalledWith("extension", "open-options");
	});

	it("does not open the options page for updates from other versions", async () => {
		const { deps } = makeDeps({
			lastUsedVersion: "2.0.1",
			installedWith: { reason: "update", previousVersion: "2.0.1" },
		});
		const createTab = vi.spyOn(chrome.tabs, "create");

		await handleStartup(deps);

		expect(createTab).not.toHaveBeenCalled();
		expect(deps.tracker.event).toHaveBeenCalledWith("extension", "update", "2.0.1");
	});

	it("routes a failure anywhere in the chain to the tracker instead of throwing", async () => {
		const { deps } = makeDeps({ lastUsedVersion: "" });
		const boom = new Error("storage exploded");

		deps.storage.set = () => Promise.reject(boom);

		await handleStartup(deps);

		expect(deps.tracker.exception).toHaveBeenCalledWith(boom);
	});
});
