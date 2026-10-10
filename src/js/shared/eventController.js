import control from "@/shared/control";
import { createController } from "@/shared/controller";

class MessageTarget extends EventTarget {
	static Name = "RuntimeMessage";

	constructor()
	{
		super();

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
		payload = {},
		local) =>
	{
		const messageBody = { message, ...payload };

		if (control.isHeld() && local) {
				// when the popup has control and it wants to send the message
				// locally, we need to trigger an event that mimics the
				// runtime.onMessage event
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

	// create this context's controller and start it once this context holds
	// control.  returns the controller and a function for sending messages to
	// whichever context holds control.
export default function initEventController({
	popupLink })
{
	const runtimeMessage = new MessageTarget();
	const controller = createController({ popupLink });

	function handleMessage(
		{ message, ...payload },
		sender,
		sendResponse)
	{
		if (Object.hasOwn(controller.api, message)) {
			sendResponse(controller.api[message](payload));
		}
	}

	controller.listen();
	control.claimWhenAvailable(() => {
			// don't return start()'s promise, since a task that returns a
			// promise gives up control when it settles
		controller.start();
		runtimeMessage.addListener(handleMessage);
	});

	return {
		controller,
		sendMessage: runtimeMessage.sendMessage
	};
}
