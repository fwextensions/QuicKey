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
