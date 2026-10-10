import control from "@/shared/control";

	// messages between contexts name an API method in their `message` key, and
	// the rest of the message is the payload passed to that method.  this
	// returns a listener that makes that call on api, and returns its result.
	// messages that don't name one of api's methods are ignored.
export function createApiDispatcher(
	api)
{
	return ({ message, ...payload } = {}) => Object.hasOwn(api, message)
		? api[message](payload)
		: undefined;
}


	// send a runtime message that calls the named method in whichever context
	// is serving it
export function sendApiMessage(
	name,
	payload = {})
{
	return chrome.runtime.sendMessage({ message: name, ...payload });
}


	// answer runtime messages that name one of api's methods with the method's
	// result.  other messages are left for other listeners to answer.  returns
	// a function that stops serving the api.
export function serveApi(
	api)
{
	const dispatch = createApiDispatcher(api);
	const listener = (message, sender, sendResponse) => {
		if (!Object.hasOwn(api, message?.message)) {
			return;
		}

		Promise.resolve()
			.then(() => dispatch(message))
			.then(sendResponse, (error) => {
				console.error(error);
				sendResponse();
			});

			// keep the channel open for the async response
		return true;
	};

	chrome.runtime.onMessage.addListener(listener);

	return () => chrome.runtime.onMessage.removeListener(listener);
}


	// return an object with a method for each name, which calls the method on
	// the object getLocal() returns when this context holds control, or else
	// calls callRemote(name, ...args).  pass no getLocal for a context that
	// never holds control.
export function bindApi(
	names,
	getLocal,
	callRemote)
{
	return Object.fromEntries(names.map((name) => [
		name,
		(...args) => (getLocal && control.isHeld())
			? Promise.resolve(getLocal()[name](...args))
			: callRemote(name, ...args)
	]));
}
