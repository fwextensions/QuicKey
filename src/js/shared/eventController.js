import control from "@/shared/control";
import initTabEvents from "@/shared/tabEventHandlers";
import initCommandEvents from "@/shared/commandHandlers";

class MessageTarget extends EventTarget {
	static Name = "RuntimeMessage";

	constructor(
		useLocalMessaging = false)
	{
		super();

		this.useLocalMessaging = useLocalMessaging;
		this.listeners = new Map();
	}

	addListener = (
		callback) =>
	{
		const listener = (event) => {
			const { detail: { message, sendResponse } } = event;
				// mimic the signature of the runtime.onMessage event listener
			const result = callback(message, null, sendResponse);

				// the callback can return true to keep the async
				// sendResponse call alive.  otherwise, resolve the
				// promise now, in case it wasn't resolved in the callback,
				// so that the sendMessage() call that triggered this
				// event will be resolved.
			if (result !== true) {
				sendResponse(result);
			}
		};

			// add the listener to both the runtime.onMessage event and our custom
			// event.  that way, if the popup has control, we'll still be listening
			// to the runtime.sendMessage() call from the options page when a
			// setting changes.
		chrome.runtime.onMessage.addListener(callback);
		this.addEventListener(MessageTarget.Name, listener);
		this.listeners.set(callback, listener);
	}

	removeListener = (
		callback) =>
	{
		chrome.runtime.onMessage.removeListener(callback);
		this.removeEventListener(MessageTarget.Name, this.listeners.get(callback));
	}

	sendMessage = (
		message,
		payload = {}) =>
	{
		const messageBody = { message, ...payload };

		if (this.useLocalMessaging && control.isHeld()) {
				// when the popup has control and it calls this function, we need
				// to trigger an event that mimics the runtime.onMessage event
			const { promise, resolve } = Promise.withResolvers();
			const detail = {
				message: messageBody,
				sendResponse: resolve,
			};

			this.dispatchEvent(new CustomEvent(MessageTarget.Name, { detail }));

			return promise;
		} else {
			return chrome.runtime.sendMessage(messageBody);
		}
	}
}

export default function initEventController({
	useLocalMessaging = false,
	...context })
{
	const runtimeMessage = new MessageTarget(useLocalMessaging);
	const innerContext = {
		...context,
		runtimeMessage,
	};

	control.claimWhenAvailable(() => {
		initTabEvents(innerContext);
		initCommandEvents(innerContext);
	});

	return runtimeMessage.sendMessage;
}
