import { describe, it, expect, beforeEach, vi } from "vitest";
import { createApiDispatcher, serveApi, bindApi, sendApiMessage } from "@/shared/api";
import control from "@/shared/control";

vi.mock("@/shared/control", () => ({
	default: { isHeld: vi.fn(() => false) },
}));


async function flush()
{
	await new Promise((resolve) => setTimeout(resolve, 0));
}


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


describe("serveApi", () => {
	it("answers a message that names a method with its result", async () => {
		const stop = serveApi({ getValue: async ({ x }) => x * 2 });

		const sendResponse = vi.fn();
		const [keepOpen] = chrome.runtime.onMessage.dispatch(
			{ message: "getValue", x: 21 }, {}, sendResponse);

		await flush();

		expect(keepOpen).toBe(true);
		expect(sendResponse).toHaveBeenCalledExactlyOnceWith(42);
		stop();
	});

	it("leaves other messages for other listeners", () => {
		const stop = serveApi({ getValue: () => 1 });
		const sendResponse = vi.fn();
		const [keepOpen] = chrome.runtime.onMessage.dispatch(
			{ message: "reopenPopup" }, {}, sendResponse);

		expect(keepOpen).toBeUndefined();
		expect(sendResponse).not.toHaveBeenCalled();
		stop();
		expect(chrome.runtime.onMessage.listenerCount()).toBe(0);
	});

	it("still responds when the method throws, so the caller isn't left waiting", async () => {
		const error = new Error("nope");
		const stop = serveApi({ fail: () => { throw error; } });
		const sendResponse = vi.fn();

		vi.spyOn(console, "error").mockImplementation(() => {});
		chrome.runtime.onMessage.dispatch({ message: "fail" }, {}, sendResponse);
		await flush();

		expect(console.error).toHaveBeenCalledWith(error);
		expect(sendResponse).toHaveBeenCalledExactlyOnceWith();
		stop();
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


describe("sendApiMessage", () => {
	it("sends the method name and payload in one message", () => {
		const spy = vi.spyOn(chrome.runtime, "sendMessage");

		sendApiMessage("applySetting", { key: "k", value: 1 });

		expect(spy).toHaveBeenCalledExactlyOnceWith({ message: "applySetting", key: "k", value: 1 });
	});
});
