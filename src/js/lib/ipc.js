import { PromiseWithResolvers } from "./promise-with-resolvers";

console.log("----------- loading lib/ipc.js");

const ChannelPrefix = "//ipc/";

class Connection {
	#port;
	#receiversByName;
	#promisesByID = {};
// TODO: do we need postQueue?
	#postQueue = [];
	#receiveQueue = new Set();
	#currentCallID = 0;

	constructor(
		port,
		receiversByName)
	{
		this.#port = port;
		this.#receiversByName = receiversByName;

		this.#port.onMessage.addListener(this.#handleMessage);
		this.#port.onDisconnect.addListener(this.#handleDisconnect);
	}

	call(
		name,
		data)
	{
		const id = this.#currentCallID++;
		const promise = new PromiseWithResolvers();
console.log("---------- call in Connection", name, id);

		this.#promisesByID[id] = promise;
		this.#post({ type: "call", id, name, data });

		return promise;
	}

	handleNewReceiver(
		name)
	{
		setTimeout(async () => {
			for (const message of this.#receiveQueue) {
				if (message.name === name) {
					this.#receiveQueue.delete(message);
					await this.#handleCall(message);
				}
			}
		});
	}

	#post(
		message)
	{
		this.#port?.postMessage(message);
	}

	#handleDisconnect = () =>
	{
		this.#port?.onMessage.removeListener(this.#handleMessage);
		this.#postQueue.length = 0;
		this.#port = null;
	}

	#handleMessage = async (
		message) =>
	{
console.log("---------- handleMessage", message);
		if (!message || typeof message !== "object") {
			return;
		}

		switch (message.type) {
			case "call":
				await this.#handleCall(message);
				break;

			case "response":
				this.#handleResponse(message);
				break;

			case "error":
				this.#handleError(message);
				break;
		}
	};

	async #handleCall(
		message)
	{
		const { id, name, data } = message;
		const receiver = this.#receiversByName[name];

		if (receiver) {
			try {
				const result = await receiver(...data);

				this.#post({ type: "response", id, name, data: result });
			} catch (error) {
					// the Figma postMessage() seems to just stringify everything, but that
					// turns an Error into {}. So explicitly walk its own properties and
					// stringify that.
				const errorJSON = JSON.stringify(error, Object.getOwnPropertyNames(error));

				this.#post({ type: "error", id, name, errorJSON });
			}
		} else {
				// queue this message until a receiver is registered for it
			this.#receiveQueue.add(message);
		}
	}

	#handleResponse(
		message)
	{
console.log("---------- #handleResponse", message?.id, message?.data);
		if (message?.id in this.#promisesByID) {
			const { id, data } = message;
			const promise = this.#promisesByID[id];

			promise.resolve(data);
		} else {
			console.error("No matching promise:", message.id, message.data);
		}
	}

	#handleError(
		message)
	{
		if (message?.id in this.#promisesByID) {
			const { id, errorJSON } = message;
			const promise = this.#promisesByID[id];
				// parse the stringified error, turn it back into an Error, and reject the
				// promise with it
			const { message: errorMessage, ...rest } = JSON.parse(errorJSON);
				// passing a cause to the constructor is available in Chrome 93+
			const error = new Error(errorMessage, { cause: rest });

			promise.reject(error);
		} else {
			console.error("No matching promise for error:", message.id);
		}
	}
}

export function connect(
	portName = "")
{
	const receiversByName = {};
	const callQueue = [];
	const connections = [];

	chrome.runtime.onConnect.addListener((newPort) => {
		const [prefix, newPortName] = newPort.name.split(ChannelPrefix);

console.log("---------- got onConnect", portName, ":", ChannelPrefix, newPortName, newPort.name);
			// prefix will be empty if it matches ChannelPrefix
		if (!prefix && (!portName || newPortName === portName)) {
			createConnection(newPort);
		}
	});

	chrome.runtime.getContexts({}).then((initialViews) => {
		if (connections.length === 0 && initialViews.length > 1) {
console.log("---------- calling createConnection because views open", ChannelPrefix + portName);
			createConnection(chrome.runtime.connect({ name: ChannelPrefix + portName }));
		}
	});

	function createConnection(
		newPort)
	{
		const connection = new Connection(newPort, receiversByName);

// TODO: also need to know when the port disconnects to remove the connection

		connections.push(connection);
console.log("---------- createConnection", newPort, connections);

		if (callQueue.length) {
console.log("---------- calling callQueue", callQueue);
// TODO: also need to return the call promise from here somehow, or resolve the saved one
			callQueue.forEach(({ name, data}) => connection.call(name, data));
			callQueue.length = 0;
		}
	}

	function callConnections(
		method,
		...args)
	{
		return connections.map((connection) => connection[method](...args));
	}

	function call(
		name,
		...data)
	{
console.log("---------- call", name, data);

		if (!connections.length) {
// TODO: we need to generate a promise here to return
			callQueue.push({ name, data });

			return;
		} else if (connections.length === 1) {
			return connections[0].call(name, data);
		}

		return Promise.allSettled(callConnections("call", name, data));
	}

	function receive(
		name,
		fn)
	{
		receiversByName[name] = fn;
console.log("---------- receive", name);

		callConnections("handleNewReceiver", name);
	}

	function ignore(
		name)
	{
		delete receiversByName[name];
	}

	return {
		call,
		receive,
		ignore
	};
}
