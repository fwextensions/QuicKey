import { describe, it, expect } from "vitest";
import { createSession, transition, describeSession, Phase } from "@/shared/popupSession";

	// the popup lifecycle as a table: a session in some phase, an event, and
	// the phase and effects that should come out.  nothing here needs chrome.

const { Closed, Creating, Visible, Hidden } = Phase;

	// a session in the given phase, with any other fields overridden
function session(
	phase,
	rest = {})
{
	return { ...createSession(), phase, ...rest };
}

const open = (overrides = {}) => ({ type: "open", focusSearch: false, menuOpen: false, ...overrides });
const navigate = (overrides = {}) => ({
	type: "navigate",
	direction: -1,
	menuOpen: false,
	withPopup: false,
	iconNormal: true,
	...overrides,
});

	// strip to what the table cares about
const effectNames = (effects) => effects.map(({ effect, name }) => name ? `${effect}:${name}` : effect);


describe("the open shortcut", () => {
	it.each([
		[Closed, Creating, ["create"]],
		[Creating, Creating, []],
		[Hidden, Hidden, ["notify:showWindow"]],
		[Visible, Visible, ["notify:modifySelected"]],
	])("in %s goes to %s with %j", (from, to, expected) => {
		const [next, effects] = transition(session(from), open());

		expect(next.phase).toBe(to);
		expect(effectNames(effects)).toEqual(expected);
	});

	it("creates the window for search or for navigating, aligned accordingly", () => {
		let [, effects] = transition(session(Closed), open({ focusSearch: true }));

		expect(effects[0]).toEqual({
			effect: "create",
			focusSearch: true,
			navigatingRecents: false,
			alignment: "center-center",
		});

		[, effects] = transition(session(Closed, { navigatingRecents: true }), open());

		expect(effects[0]).toMatchObject({ navigatingRecents: true, alignment: "right-center" });
	});

	it("holds a second press for the page while it's still loading, and delivers it when the page is ready", () => {
		const [creating] = transition(session(Closed), open());
		const [pending, heldEffects] = transition(creating, open());

		expect(heldEffects).toEqual([]);
		expect(pending.pending).toEqual(["modifySelected", { direction: 1 }]);

		const [ready, effects] = transition(pending, { type: "pageReady" });

		expect(ready).toEqual({ phase: Visible, navigatingRecents: false, pending: null });
		expect(effects).toEqual([{ effect: "notify", name: "modifySelected", payload: { direction: 1 } }]);
	});

	it("asks the page to close the window when a focused popup can't be reached", () => {
		const [, [effect]] = transition(session(Visible), open());

		expect(effect).toMatchObject({ name: "modifySelected", closeIfUndelivered: true });
	});

	it("moves the menu's selection instead, whatever the popup is doing", () => {
		for (const phase of Object.values(Phase)) {
			const [next, effects] = transition(session(phase), open({ menuOpen: true }));

			expect(next.phase).toBe(phase);
			expect(effects).toEqual([{ effect: "notify", name: "modifySelected", payload: { direction: 1 } }]);
		}
	});
});


describe("the previous and next shortcuts", () => {
	it("move the selection of a focused popup, or the menu, in the opposite direction", () => {
		let [next, effects] = transition(session(Visible), navigate({ direction: -1 }));

		expect(next.navigatingRecents).toBe(false);
		expect(effects).toEqual([{ effect: "notify", name: "modifySelected", payload: { direction: 1 } }]);

		[, effects] = transition(session(Closed), navigate({ direction: 1, menuOpen: true }));

		expect(effects).toEqual([{ effect: "notify", name: "modifySelected", payload: { direction: -1 } }]);
	});

	it("switch tabs directly when not navigating with the popup", () => {
		const [next, effects] = transition(session(Closed), navigate({ direction: -1 }));

		expect(next).toEqual(session(Closed));
		expect(effectNames(effects)).toEqual(["navigateRecents", "track"]);
		expect(effects[1]).toEqual({ effect: "track", action: "previous", label: "single" });
	});

	it("ignore next unless the icon is still inverted from a previous press", () => {
		let [, effects] = transition(session(Closed), navigate({ direction: 1 }));

		expect(effectNames(effects)).toEqual(["track"]);

		[, effects] = transition(session(Closed), navigate({ direction: 1, iconNormal: false }));

		expect(effectNames(effects)).toEqual(["navigateRecents", "track"]);
		expect(effects[1]).toEqual({ effect: "track", action: "next", label: "repeated" });
	});

	describe("when navigating with the popup", () => {
		it("open the popup to navigate when there is none", () => {
			const [next, effects] = transition(session(Closed), navigate({ withPopup: true }));

			expect(next).toMatchObject({ phase: Creating, navigatingRecents: true });
			expect(effectNames(effects)).toEqual(["flushAddTab", "create", "track"]);
			expect(effects[1]).toMatchObject({ navigatingRecents: true, alignment: "right-center" });
		});

		it("move a hidden popup's selection, which shows it", () => {
			const [next, effects] = transition(session(Hidden), navigate({ withPopup: true }));

			expect(next.navigatingRecents).toBe(true);
			expect(effects).toEqual([
				{ effect: "flushAddTab" },
				{ effect: "notify", name: "modifySelected", payload: { direction: 1, navigatingRecents: true } },
				{ effect: "track", action: "previous", label: "single" },
			]);
		});

		it("keep moving the selection of a popup that's already navigating", () => {
			const [next, effects] = transition(
				session(Visible, { navigatingRecents: true }),
				navigate({ withPopup: true, direction: 1 })
			);

			expect(next.navigatingRecents).toBe(true);
			expect(effects[1]).toEqual({
				effect: "notify",
				name: "modifySelected",
				payload: { direction: -1, navigatingRecents: true },
			});
		});

		it("hold the selection change for a page that's still loading", () => {
			const [next, effects] = transition(session(Creating), navigate({ withPopup: true }));

			expect(next).toMatchObject({
				phase: Creating,
				navigatingRecents: true,
				pending: ["modifySelected", { direction: 1, navigatingRecents: true }],
			});
			expect(effectNames(effects)).toEqual(["flushAddTab", "track"]);
		});

		it("ignore next while the popup is hidden, since that's the active tab", () => {
			const [next, effects] = transition(session(Hidden), navigate({ withPopup: true, direction: 1 }));

			expect(next).toEqual(session(Hidden));
			expect(effectNames(effects)).toEqual(["track"]);
		});
	});
});


describe("stopping navigation", () => {
	it("tells the page when asked to, and only if it was navigating", () => {
		let [next, effects] = transition(
			session(Visible, { navigatingRecents: true }),
			{ type: "stopNavigating", notify: true }
		);

		expect(next.navigatingRecents).toBe(false);
		expect(effects).toEqual([{ effect: "notify", name: "stopNavigatingRecents", payload: {} }]);

		[, effects] = transition(session(Visible), { type: "stopNavigating", notify: true });

		expect(effects).toEqual([]);

		[next, effects] = transition(session(Visible, { navigatingRecents: true }), { type: "stopNavigating" });

		expect(next.navigatingRecents).toBe(false);
		expect(effects).toEqual([]);
	});
});


describe("the window's own events", () => {
	it.each([
		["created", Closed, Creating],
		["created", Hidden, Hidden],
		["createAborted", Creating, Closed],
		["createAborted", Visible, Visible],
		["shown", Creating, Visible],
		["shown", Hidden, Visible],
		["hidden", Visible, Hidden],
		["hidden", Closed, Closed],
		["blurred", Visible, Hidden],
		["blurred", Closed, Closed],
		["closed", Visible, Closed],
		["pageReady", Closed, Visible],
		["pageReady", Hidden, Visible],
	])("%s takes %s to %s", (type, from, to) => {
		const [next, effects] = transition(session(from), { type });

		expect(next.phase).toBe(to);
		expect(effects).toEqual([]);
	});

	it("hiding or closing ends navigating, blurring doesn't", () => {
		const navigating = session(Visible, { navigatingRecents: true });

		expect(transition(navigating, { type: "hidden" })[0].navigatingRecents).toBe(false);
		expect(transition(navigating, { type: "closed" })[0].navigatingRecents).toBe(false);
		expect(transition(navigating, { type: "blurred" })[0].navigatingRecents).toBe(true);
	});

	it("closing forgets anything held for the page", () => {
		const [next] = transition(session(Creating, { pending: ["modifySelected", {}] }), { type: "closed" });

		expect(next).toEqual(createSession());
	});

	it("ignores events it doesn't know", () => {
		const before = session(Visible);

		expect(transition(before, { type: "whatever" })).toEqual([before, []]);
	});
});


describe("describeSession()", () => {
	it("names the phase and what else is going on", () => {
		expect(describeSession(createSession())).toBe("closed");
		expect(describeSession(session(Creating, {
			navigatingRecents: true,
			pending: ["modifySelected", {}],
		}))).toBe("creating+navigating+pending(modifySelected)");
	});
});
