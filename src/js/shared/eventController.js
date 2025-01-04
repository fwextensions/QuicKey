import control from "@/shared/control";
import initTabEvents from "@/shared/tabEventHandlers";
import initCommandEvents from "@/shared/commandHandlers";

class MessageTarget extends EventTarget {
	static Name = "RuntimeMessage";

	constructor(
		useLocalMessaging)
	{
		super();

		this.useLocalMessaging = useLocalMessaging;
	}

	addListener = (
		callback) =>
	{
		if (this.useLocalMessaging && control.isHeld()) {
			this.addEventListener(
				MessageTarget.Name,
					// mimic the signature of the runtime.onMessage event listener
				(event) => callback(event.detail.message, null, event.detail.sendResponse)
			);
		} else {
			chrome.runtime.onMessage.addListener(callback);
		}
	}

	sendMessage = (
		message,
		payload = {},
		sendResponse = true) =>
	{
		const messageBody = { message, ...payload };

		if (this.useLocalMessaging && control.isHeld()) {
				// when the popup has control and it calls this function, we need
				// to trigger an event that mimics the runtime.onMessage event
			const detail = { message: messageBody };
			let result = Promise.resolve();

// TODO: always include the sendResponse resolver and then call it in the listener above if the callback doesn't return true.  that better mimics the behavior of the runtime.onMessage handler.
			if (sendResponse) {
				const { promise, resolve } = Promise.withResolvers();

				result = promise;
				detail.sendResponse = resolve;
			}

			this.dispatchEvent(new CustomEvent(MessageTarget.Name, { detail }));

			return result;
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
		addMessageListener: runtimeMessage.addListener,
	};

	control.claimWhenAvailable(() => {
		initTabEvents(innerContext);
		initCommandEvents(innerContext);
	});

	return runtimeMessage.sendMessage;
}
