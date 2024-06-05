import { PromiseWithResolvers } from "./promise-with-resolvers";

const PortName = "IPC";

const promisesByID = {};
const receiversByName = {};
const postQueue = [];
const receiveQueue = new Set();
const initialViews = await chrome.runtime.getContexts({});
let currentID = 0;
let port;

/**
 * Makes a call between the main and UI threads.  It returns a promise that can
 * be awaited until the other side responds.
 *
 * @param {string} name - The name of the receiver in the other thread that is
 * expected to respond this call.
 * @param {...any} data - Zero or more parameters to send to the receiver.  They
 * must be of types that can be passed through `postMessage()`.
 * @return PromiseWithResolvers<T> - A promise that will be resolved with the
 * receiver's response when it is sent.
 */
export function call(
	name,
	...data)
{
	const id = currentID++;
	const promise = new PromiseWithResolvers();

	promisesByID[id] = promise;
	post({ type: "call", id, name, data });

	return promise;
}

/**
 * Registers a function to receive calls with a particular name.  It will receive
 * whatever parameters are passed to the `call()` function.  Its return value
 * will be sent back to the caller.
 *
 * If the receiver returns a promise, then no response will be sent to the
 * caller until the promise resolves.
 *
 * Only a single function can respond to any given name, so subsequent calls to
 * `receive()` will replace the previously registered function.
 *
 * @param {string} name - The name of the receiver.
 * @param {(...data: any) => unknown} fn - The function that will receive calls
 * to the `name` parameter.
 */
export function receive(
	name,
	fn)
{
	receiversByName[name] = fn;

		// now that the new receiver has been registered, call it with any messages
		// that have been queued for it. We do this in a timeout so the code calling
		// receive() doesn't have to await the result.
	setTimeout(async () => {
		for (const message of receiveQueue) {
			if (message.name === name) {
				receiveQueue.delete(message);
				await handleCall(message);
			}
		}
	});
}

/**
 * Unregisters the receiver for a given call name.  Subsequent calls to that
 * name from the other thread will never return.
 *
 * @param {string} name - The name of the receiver to unregister.
 */
export function ignore(
	name)
{
	delete receiversByName[name];
}

chrome.runtime.onConnect.addListener((newPort) => {
	if (newPort.name === PortName) {
		connectPort(newPort)
		handleConnect();
	}
});

if (!port && initialViews.length > 1) {
	connectPort(chrome.runtime.connect({ name: PortName }));
}

function connectPort(
	newPort)
{
	port = newPort;
	port.onMessage.addListener(handleMessage);
	port.onDisconnect.addListener(handleDisconnect);
	handleConnect();
}

function post(
	message)
{
	if (port) {
		port.postMessage(message);
	} else {
		postQueue.push(message);
	}
}

function handleConnect() {
	if (postQueue.length) {
		postQueue.forEach((message) => post(message));
		postQueue.length = 0;
	}
}

function handleDisconnect()
{
	port.onMessage.removeListener(handleMessage);
	postQueue.length = 0;
	port = null;
}

async function handleCall(
	message)
{
	if (message?.name in receiversByName) {
		const { id, name, data } = message;
		const receiver = receiversByName[name];

		try {
			const response = await receiver(...data);

			post({ type: "response", id, name, data: response });
		} catch (error) {
				// the Figma postMessage() seems to just stringify everything, but that
				// turns an Error into {}. So explicitly walk its own properties and
				// stringify that.
			const errorJSON = JSON.stringify(error, Object.getOwnPropertyNames(error));

			post({ type: "error", id, name, errorJSON });
		}
	} else {
			// queue this message until a receiver is registered for it
		receiveQueue.add(message);
	}
}

function handleResponse(
	message)
{
	if (message?.id in promisesByID) {
		const { id, data } = message;
		const promise = promisesByID[id];

		promise.resolve(data);
	}
}

function handleError(
	message)
{
	if (message?.id in promisesByID) {
		const { id, errorJSON } = message;
		const promise = promisesByID[id];
			// parse the stringified error, turn it back into an Error, and reject the
			// promise with it
		const { message: errorMessage, ...rest } = JSON.parse(errorJSON);
			// passing a cause to the constructor is available in Chrome 93+
		const error = new Error(errorMessage, { cause: rest });

		promise.reject(error);
	}
}

async function handleMessage(
	message)
{
	if (!message || typeof message !== "object") {
		return;
	}

	switch (message.type) {
		case "call":
			await handleCall(message);
			break;

		case "response":
			handleResponse(message);
			break;

		case "error":
			handleError(message);
			break;

		case "connect":
			handleConnect();
			break;
	}
}
