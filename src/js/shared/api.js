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
