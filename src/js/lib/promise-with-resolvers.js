const noop = () => void (0);

/**
 * Represents a deferred promise that can be resolved or rejected via method
 * calls on the instance.
 */
export class PromiseWithResolvers {
	#promise;

	[Symbol.toStringTag] = "Promise";

	/**
	 * Resolves the underlying promise with a specified value.
	 *
	 * @param value - The value to resolve the promise with.
	 */
	resolve = noop;

	/**
	 * Rejects the underlying promise with a specified reason.
	 *
	 * @param reason - The reason for rejecting the promise.
	 */
	reject = noop;

	/**
	 * Creates a new instance of PromiseWithResolvers.
	 */
	constructor()
	{
		this.#promise = new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}

	/**
	 * Attaches callbacks for the resolution and/or rejection of the promise.
	 *
	 * @param onFulfilled - The callback to execute when the promise is resolved.
	 * @param onRejected - The callback to execute when the promise is rejected.
	 * @returns - A new promise resolved or rejected by the onFulfilled or
	 * onRejected callback.
	 */
	then(
		onFulfilled,
		onRejected)
	{
		return this.#promise.then(onFulfilled, onRejected);
	}

	/**
	 * Attaches a callback for the rejection of the promise.
	 *
	 * @param onRejected - The callback to execute when the promise is rejected.
	 * @returns - A new promise resolved by the onRejected callback.
	 */
	catch(
		onRejected)
	{
		return this.#promise.catch(onRejected);
	}

	/**
	 * Attaches a callback that is executed when the promise is settled, whether
	 * fulfilled or rejected.
	 *
	 * @param onFinally - The callback to execute when the promise is settled.
	 * @returns - A new promise resolved by the onFinally callback.
	 */
	finally(
		onFinally)
	{
		return this.#promise.finally(onFinally);
	}
}
