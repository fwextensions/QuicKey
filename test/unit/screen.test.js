import { describe, it, expect, beforeEach, vi } from "vitest";

// getScreenFromWindow() used to return undefined in two ways, and calcBounds()
// throws on screen.left when it does, which takes the popup out entirely:
//
//   Caught unhandled promise rejection: TypeError: Cannot read properties of
//   undefined (reading 'left') at calcBounds at Object.create
//
// seen after a restart that restored 107 windows.  The multi-screen branch
// tested overlap against maxOverlapX/maxOverlapY variables that were declared
// and never assigned, so it wasn't picking the screen with the most overlap --
// it took the last screen the window wasn't entirely clear of, and picked
// nothing at all when the window was clear of every one of them.

const Left = { left: 0, top: 0, width: 1920, height: 1080 };
const Right = { left: 1920, top: 0, width: 1280, height: 1024 };

function display(
	...bounds)
{
	return bounds.map((workArea) => ({ workArea }));
}

	// screen.js reads chrome.system.display at import time, so each case has to
	// set the fake up before the module is loaded
async function loadScreen(
	displays)
{
	vi.resetModules();
	globalThis.chrome = {
		system: {
			display: {
				onDisplayChanged: { addListener: vi.fn() },
				getInfo: vi.fn(() => Promise.resolve(displays)),
			},
		},
	};

	const module = await import("@/background/screen");

		// let the getInfo() promise settle, since nothing in the module awaits it
	await Promise.resolve();
	await Promise.resolve();

	return module.getScreenFromWindow;
}


describe("getScreenFromWindow", () => {
	it("picks the screen a window sits on", async () => {
		const getScreenFromWindow = await loadScreen(display(Left, Right));

		expect(getScreenFromWindow({ left: 100, top: 100, width: 800, height: 600 }))
			.toMatchObject({ left: 0, width: 1920 });
		expect(getScreenFromWindow({ left: 2000, top: 100, width: 800, height: 600 }))
			.toMatchObject({ left: 1920, width: 1280 });
	});

		// the case the old code got wrong even when it returned something: a
		// window straddling two screens belongs to the one it covers more of
	it("picks the screen with the most overlap when a window straddles two", async () => {
		const getScreenFromWindow = await loadScreen(display(Left, Right));

			// 200px on the left screen, 800px on the right
		expect(getScreenFromWindow({ left: 1720, top: 100, width: 1000, height: 600 }))
			.toMatchObject({ left: 1920 });

			// and the other way round
		expect(getScreenFromWindow({ left: 1120, top: 100, width: 1000, height: 600 }))
			.toMatchObject({ left: 0 });
	});

		// the crash: a window restored onto a monitor that's no longer there
	it("returns the nearest screen for a window that overlaps none", async () => {
		const getScreenFromWindow = await loadScreen(display(Left, Right));
		const screen = getScreenFromWindow(
			{ left: 4000, top: 2000, width: 800, height: 600 });

		expect(screen).toBeDefined();
		expect(screen.left).toBeDefined();
			// off to the lower right of both, so the right-hand screen is nearer
		expect(screen).toMatchObject({ left: 1920 });
	});

	it("returns the nearest screen for a window at negative coordinates", async () => {
		const getScreenFromWindow = await loadScreen(display(Left, Right));
		const screen = getScreenFromWindow(
			{ left: -3000, top: -2000, width: 800, height: 600 });

		expect(screen).toMatchObject({ left: 0 });
	});

		// a window that misses on one axis only still overlaps nothing -- the
		// old code scored this as a match because it tested the axes separately
	it("doesn't treat a window that misses on one axis as overlapping", async () => {
		const getScreenFromWindow = await loadScreen(display(Left, Right));
		const screen = getScreenFromWindow(
			{ left: 100, top: 5000, width: 800, height: 600 });

		expect(screen).toBeDefined();
		expect(screen).toMatchObject({ left: 0 });
	});

	it("never returns undefined before the display info arrives", async () => {
		vi.resetModules();
		globalThis.chrome = {
			system: {
				display: {
					onDisplayChanged: { addListener: vi.fn() },
						// never resolves, standing in for the window between the
						// worker starting and getInfo() answering
					getInfo: vi.fn(() => new Promise(() => {})),
				},
			},
		};

		const { getScreenFromWindow } = await import("@/background/screen");

			// falls back to the window's own bounds, so the popup lands on it
		expect(getScreenFromWindow({ left: 200, top: 100, width: 800, height: 600 }))
			.toMatchObject({ left: 200, top: 100, width: 800, height: 600, right: 1000 });

			// and to something plausible when there's no window either
		const screen = getScreenFromWindow(undefined);

		expect(screen).toBeDefined();
		expect(screen.width).toBeGreaterThan(0);
	});

	it("handles a single screen", async () => {
		const getScreenFromWindow = await loadScreen(display(Left));

		expect(getScreenFromWindow({ left: 9000, top: 9000, width: 800, height: 600 }))
			.toMatchObject({ left: 0, width: 1920 });
		expect(getScreenFromWindow(undefined)).toMatchObject({ left: 0 });
	});
});
