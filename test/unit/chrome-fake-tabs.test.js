import { describe, it, expect, beforeEach, vi } from "vitest";
import { createChromeFake } from "../support/chrome-fake";

	// behavior of the stateful tab/window model in the chrome fake itself:
	// mutating APIs must both change what query() sees and fire the same
	// events the real browser would, since the interaction tests build on
	// exactly that contract.

let chromeFake;

beforeEach(() => {
	chromeFake = createChromeFake({
		tabs: [
			{ id: 1, url: "https://a.example.com/", windowId: 1, active: true },
			{ id: 2, url: "https://b.example.com/", windowId: 1 },
			{ id: 3, url: "https://c.example.com/", windowId: 2 },
		],
	});
});


describe("seeding", () => {
	it("builds windows implicitly and focuses the one holding the active tab", async () => {
		const { windows, focusedWindowId } = chromeFake.tabs._dump();

		expect(windows.map(({ id }) => id)).toEqual([1, 2]);
		expect(focusedWindowId).toBe(1);

		const [activeInOther] = await chromeFake.tabs.query({ active: true, windowId: 2 });

			// a window without an explicitly active tab activates its first one
		expect(activeInOther.id).toBe(3);
	});

	it("supports the query filters the source actually uses", async () => {
		const current = await chromeFake.tabs.query({ active: true, currentWindow: true, windowType: "normal" });

		expect(current.map(({ id }) => id)).toEqual([1]);

		const lastFocused = await chromeFake.tabs.query({ active: true, lastFocusedWindow: true });

		expect(lastFocused.map(({ id }) => id)).toEqual([1]);

		const byURL = await chromeFake.tabs.query({ url: "https://b.example.com/*" });

		expect(byURL.map(({ id }) => id)).toEqual([2]);

		await expect(async () => chromeFake.tabs.query({ pinned: true }))
			.rejects.toThrow("unsupported tabs.query() filter");
	});
});


describe("tabs.update / activation", () => {
	it("activating a tab fires onActivated and updates query()", async () => {
		const onActivated = vi.fn();

		chromeFake.tabs.onActivated.addListener(onActivated);
		await chromeFake.tabs.update(2, { active: true });

		expect(onActivated).toHaveBeenCalledExactlyOnceWith({ tabId: 2, windowId: 1 });

		const active = await chromeFake.tabs.query({ active: true, windowId: 1 });

		expect(active.map(({ id }) => id)).toEqual([2]);
	});

	it("activating the already-active tab fires nothing, like the real browser", async () => {
		const onActivated = vi.fn();

		chromeFake.tabs.onActivated.addListener(onActivated);
		await chromeFake.tabs.update(1, { active: true });

		expect(onActivated).not.toHaveBeenCalled();
	});
});


describe("tabs.create", () => {
	it("fires onCreated then onActivated for an active tab, in browser order", async () => {
		const calls = [];

		chromeFake.tabs.onCreated.addListener((tab) => calls.push(["created", tab.id]));
		chromeFake.tabs.onActivated.addListener(({ tabId }) => calls.push(["activated", tabId]));

		const tab = await chromeFake.tabs.create({ url: "https://d.example.com/" });

		expect(calls).toEqual([["created", tab.id], ["activated", tab.id]]);
	});

	it("creating an inactive tab leaves the active tab alone", async () => {
		await chromeFake.tabs.create({ url: "https://d.example.com/", active: false });

		const active = await chromeFake.tabs.query({ active: true, windowId: 1 });

		expect(active.map(({ id }) => id)).toEqual([1]);
	});
});


describe("tabs.remove", () => {
	it("fires onRemoved and activates another tab when the active one closes", async () => {
		const onRemoved = vi.fn();
		const onActivated = vi.fn();

		chromeFake.tabs.onRemoved.addListener(onRemoved);
		chromeFake.tabs.onActivated.addListener(onActivated);

		await chromeFake.tabs.remove(1);

		expect(onRemoved).toHaveBeenCalledExactlyOnceWith(1, { windowId: 1, isWindowClosing: false });
		expect(onActivated).toHaveBeenCalledExactlyOnceWith({ tabId: 2, windowId: 1 });
	});

	it("removing a window's last tab drops the window and moves focus", async () => {
		const onFocusChanged = vi.fn();

		chromeFake.windows.onFocusChanged.addListener(onFocusChanged);

		await chromeFake.tabs.remove([1, 2]);

		const { windows, focusedWindowId } = chromeFake.tabs._dump();

		expect(windows.map(({ id }) => id)).toEqual([2]);
		expect(focusedWindowId).toBe(2);
		expect(onFocusChanged).toHaveBeenCalledWith(2);
	});
});


describe("windows", () => {
	it("windows.update({focused}) refocuses and fires onFocusChanged once", async () => {
		const onFocusChanged = vi.fn();

		chromeFake.windows.onFocusChanged.addListener(onFocusChanged);

		await chromeFake.windows.update(2, { focused: true });
		await chromeFake.windows.update(2, { focused: true });

		expect(onFocusChanged).toHaveBeenCalledExactlyOnceWith(2);

		const current = await chromeFake.tabs.query({ active: true, currentWindow: true });

		expect(current.map(({ id }) => id)).toEqual([3]);
	});

	it("windows.create() opens a window with a tab and focuses it", async () => {
		const win = await chromeFake.windows.create({ url: "https://new.example.com/", type: "popup" });

		expect(win.type).toBe("popup");
		expect(win.tabs).toHaveLength(1);
		expect(chromeFake.tabs._dump().focusedWindowId).toBe(win.id);
	});
});
