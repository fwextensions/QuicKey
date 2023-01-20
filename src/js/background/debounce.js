export function debounce(
	func,
	wait,
	thisArg = this)
{
	let timeout;
	let exec;


	const debouncedFunc = (...args) => {
		exec = () => {
				// clear the timer in case we're being called by execute() so
				// that we don't get called twice
			debouncedFunc.cancel();

				// return the result of func, in case we're being called by
				// execute() and it returns a promise, so the caller can chain it
			return func.apply(thisArg, args);
		};


		clearTimeout(timeout);
		timeout = setTimeout(exec, wait);
	};


	debouncedFunc.cancel = () => {
		clearTimeout(timeout);
		timeout = null;
		exec = null;
	};


	debouncedFunc.execute = () => Promise.resolve(exec && exec());


	return debouncedFunc;
}
