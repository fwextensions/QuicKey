export function debounce(
	func,
	wait,
	thisArg = this)
{
	const waitingResolvers = [];
	let timeout;
	let exec;


	const debouncedFunc = (...args) => {
		exec = () => {
				// return the result of func, in case we're being called by
				// execute() and it returns a promise, so the caller can chain it
			const result = func.apply(thisArg, args);

				// resolve any waiting promises with the result of func()
			waitingResolvers.forEach((resolve) => resolve(result));

				// clear the timer in case we're being called by execute() so
				// that we don't get called twice, and clear waitingResolvers
			debouncedFunc.cancel();

			return result;
		};


		clearTimeout(timeout);

		if (waitingResolvers.length) {
			exec();
		} else {
			timeout = setTimeout(exec, wait);
		}
	};


	debouncedFunc.cancel = () => {
		clearTimeout(timeout);
		timeout = null;
		exec = null;
		waitingResolvers.length = 0;
	};


	debouncedFunc.execute = (waitForNext) => {
		let result = null;

		if (exec) {
			result = exec();
		} else if (waitForNext) {
				// there's no execution waiting for the timeout to fire, but the
				// caller wants to wait for the next one, so return a promise that
				// will resolve with the result of the next execution, and which
				// will cause that call to fire immediately and not debounce
			const { promise, resolve } = Promise.withResolvers();

			waitingResolvers.push(resolve);
			result = promise;
		}

		return Promise.resolve(result);
	};


	return debouncedFunc;
}
