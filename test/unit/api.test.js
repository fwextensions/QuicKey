import { describe, it, expect, beforeEach, vi } from "vitest";
import { createApiDispatcher, bindApi } from "@/shared/api";
import control from "@/shared/control";

vi.mock("@/shared/control", () => ({
	default: { isHeld: vi.fn(() => false) },
}));


beforeEach(() => {
	vi.clearAllMocks();
	control.isHeld.mockReturnValue(false);
});


describe("createApiDispatcher", () => {
	it("calls the method a message names, with the rest of the message as its payload", () => {
		const api = { greet: vi.fn(({ name }) => `hi ${name}`) };
		const dispatch = createApiDispatcher(api);

		expect(dispatch({ message: "greet", name: "Q" })).toBe("hi Q");
		expect(api.greet).toHaveBeenCalledExactlyOnceWith({ name: "Q" });
	});

	it("ignores messages that don't name one of the api's own methods", () => {
		const dispatch = createApiDispatcher({ greet: vi.fn() });

		expect(dispatch({ message: "toString" })).toBeUndefined();
		expect(dispatch("closedByEsc")).toBeUndefined();
		expect(dispatch()).toBeUndefined();
	});
});


describe("bindApi", () => {
	const local = { add: vi.fn((a, b) => a + b) };
	const callRemote = vi.fn(() => Promise.resolve("remote"));

	it("calls the local implementation when this context holds control", async () => {
		control.isHeld.mockReturnValue(true);

		const api = bindApi(["add"], () => local, callRemote);

		expect(await api.add(1, 2)).toBe(3);
		expect(callRemote).not.toHaveBeenCalled();
	});

	it("calls the remote one when it doesn't", async () => {
		const api = bindApi(["add"], () => local, callRemote);

		expect(await api.add(1, 2)).toBe("remote");
		expect(callRemote).toHaveBeenCalledExactlyOnceWith("add", 1, 2);
		expect(local.add).not.toHaveBeenCalled();
	});

	it("always calls the remote one when there's no local implementation", async () => {
		control.isHeld.mockReturnValue(true);

		const api = bindApi(["add"], undefined, callRemote);

		expect(await api.add(1, 2)).toBe("remote");
	});

	it("only has the methods it was given", () => {
		expect(Object.keys(bindApi(["a", "b"], null, callRemote))).toEqual(["a", "b"]);
	});
});

