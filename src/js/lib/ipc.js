import { AbortablePromise } from "@/lib/abortable-promise";

const ChannelPrefix = "ipc://";

class Channel {
	#port;
	#receiversByName;
	#promisesByID = {};
	#receiveQueue = new Set();
	#currentCallID = 0;
	#initiatorName = "unnamed";
	#controller = new AbortController();
	#onDisconnect;

	constructor(
		port,
		receiversByName,
		onDisconnect,
		initiatorName)
	{
		this.#port = port;
		this.#receiversByName = receiversByName;
		this.#onDisconnect = onDisconnect;
		this.#initiatorName = initiatorName || this.#initiatorName;

		this.#port.onMessage.addListener(this.#handleMessage);
		this.#port.onDisconnect.addListener(this.#handleDisconnect);
	}

	call(
		name,
		data)
	{
		const id = this.#currentCallID++;
		const promise = this.createPromise();

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

	createPromise()
	{
		return new AbortablePromise(this.#controller);
	}

	get name()
	{
// TODO: should this be the port name, or the initiator name?
		return this.#port.name;
	}

	#post(
		message)
	{
!this.#port && console.warn("---------- post NO PORT", message, this.#port, this.#promisesByID);
		this.#port?.postMessage(message);
	}

	#handleDisconnect = () =>
	{
		this.#onDisconnect?.(this);
		this.#port?.onMessage.removeListener(this.#handleMessage);
		this.#port = null;
		this.#controller.abort(new Error("ChannelDisconnected"));
	}

	#handleMessage = async (
		message) =>
	{
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
				const result = await receiver(...data, this);

				this.#post({ type: "response", id, name, data: result });
			} catch (error) {
					// the Figma postMessage() seems to just stringify everything, but that
					// turns an Error into {}. So explicitly walk its own properties and
					// stringify that.
				const errorJSON = JSON.stringify(error, Object.getOwnPropertyNames(error));

				this.#post({ type: "error", id, name, errorJSON });
			}
		} else {
console.error("---------- #handleCall no receiver", name, id, data);
				// queue this message until a receiver is registered for it
			this.#receiveQueue.add(message);
		}
	}

	#handleResponse(
		message)
	{
		if (message?.id in this.#promisesByID) {
			const { id, data } = message;
			const promise = this.#promisesByID[id];

			promise.resolve(data);
			delete this.#promisesByID[id];
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
			delete this.#promisesByID[id];
		} else {
			console.error("No matching promise for error:", message.id);
		}
	}
}

export function connect(
	channelName)
{
	const receiversByName = {};
	const callQueue = [];
	const channels = [];

	chrome.runtime.onConnect.addListener(handleConnect);

	chrome.runtime.getContexts({}).then((initialViews) => {
		if (channels.length === 0 && initialViews.length > 1) {
console.log("---------- calling createChannel because views open", ChannelPrefix + channelName, location.pathname + location.search.slice(0, 10));
			createChannel(chrome.runtime.connect({ name: ChannelPrefix + channelName }));
// TODO: create a single shared port for all channels.  then a single handler would call handleMessage() on the associated channel.
		}
	});

	function handleConnect(
		newPort)
	{
		const [prefix, newPortName] = newPort.name.split(ChannelPrefix);
		const nameMatches = channelName instanceof RegExp
			? channelName.test(newPortName)
			: (!channelName || newPortName === channelName);

			// prefix will be empty if it matches ChannelPrefix
		if (!prefix && nameMatches) {
console.log("---------- got onConnect", channelName, ":", nameMatches, newPortName, newPort.name, location.pathname + location.search.slice(0, 10));
			createChannel(newPort);
		}
	}

	function handleDisconnect(
		channel)
	{
		const index = channels.indexOf(channel);

		if (index > -1) {
			channels.splice(index, 1);
		}

console.log("---------- handleDisconnect", channelName, index, channels);
	}

	function createChannel(
		newPort)
	{
		const channel = new Channel(newPort, receiversByName, handleDisconnect, channelName);

		channels.push(channel);

		if (callQueue.length) {
console.log("---------- calling callQueue", callQueue);
// TODO: also need to return the call promise from here somehow, or resolve the saved one
			callQueue.forEach(({ name, data}) => channel.call(name, data));
			callQueue.length = 0;
		}

// TODO: it's not clear that this is very useful for anything that receives calls in the background.  we always want to
//  reconnect when the popup reopens, so every time we've had to use a regex for the channel name.
		if (channelName && typeof channelName === "string") {
				// we're intended to connect to a specific port, so now that we've
				// created a channel, we don't want to connect to future ports
			chrome.runtime.onConnect.removeListener(handleConnect);
		}
	}

	function callChannels(
		method,
		...args)
	{
		return channels.map((channel) => channel[method](...args));
	}

	function call(
		name,
		...data)
	{
		if (!channels.length) {
// TODO: we need to generate a promise here to return
			callQueue.push({ name, data });

			return;
		} else if (channels.length === 1) {
			return channels[0].call(name, data);
		}

console.warn("---------- call MULTIPLE CHANNELS", name, channels);
		return Promise.allSettled(callChannels("call", name, data));
	}

	function receive(
		name,
		fn)
	{
		if (typeof name === "string") {
			receiversByName[name] = fn;
			callChannels("handleNewReceiver", name);
		} else if (typeof name === "object" && name) {
			for (const [fnName, fn] of Object.entries(name)) {
				receiversByName[fnName] = fn;
				callChannels("handleNewReceiver", fnName);
			}
		}
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
