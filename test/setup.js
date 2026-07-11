import { vi } from "vitest";
import { createChromeFake } from "./support/chrome-fake";
import { createLocksFake } from "./support/locks-fake";

	// QuicKey's source references a bare DEBUG global (e.g. the
	// `if (DEBUG) { globalThis.printTabs = ... }` at the bottom of recent-tabs.js),
	// so it must be defined before any module evaluates or the import throws.
globalThis.DEBUG = false;

	// constants.js reads navigator.userAgent / platform / languages at module
	// evaluation to derive IsMac / IsWin / Language, and storage.js and
	// control.js use navigator.locks.  install a controllable navigator before
	// any source module loads.  default to a Windows/English profile; a test
	// that needs a different platform can re-stub navigator before importing the
	// module under test.
vi.stubGlobal("navigator", {
	userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
		"(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	platform: "Win32",
	languages: ["en-US"],
	locks: createLocksFake(),
});

	// storage.js reads globalThis.location.pathname to tag which context last
	// wrote (lastSavedFrom), so a location is needed for it to import.
vi.stubGlobal("location", {
	pathname: "/background.html",
	href: "chrome-extension://quickeyfakeextensionidaaaaaaaaaa/background.html",
	search: "",
});

	// a single chrome fake per test file (setupFiles runs once per isolated
	// file).  tests reset or seed chrome.storage.local as needed in their own
	// beforeEach via chrome.storage.local.clear() / _seed().
vi.stubGlobal("chrome", createChromeFake());

	// stub the analytics trackers everywhere.  besides avoiding real GA network
	// traffic on every recent-tabs event, this short-circuits page-trackers'
	// top-level await (chrome.management.getSelf + clientID storage write) and
	// keeps the storage fake uncluttered by an analytics clientID key.
vi.mock("@/background/page-trackers", () => {
	const noopTracker = {
		event: () => {},
		pageview: () => {},
		timing: () => {},
		exception: () => {},
		set: () => {},
		send: () => {},
	};

	return {
		default: {
			background: noopTracker,
			popup: noopTracker,
			options: noopTracker,
		},
	};
});
