	// wrap func so that rapid calls collapse into one, and give the caller a
	// few ways to short-circuit the wait:
	//
	//   debounced(...args)   schedule a call for `wait` ms from now, replacing
	//                        any call already scheduled
	//   .now(...args)        call func right now with these args, dropping any
	//                        scheduled call
	//   .flush()             call func now if a call is scheduled, using the
	//                        args it was scheduled with
	//   .flushOrNext()       flush, or if nothing is scheduled, resolve when
	//                        the next call comes in and let it skip the wait
	//   .cancel()            drop any scheduled call
	//
	// the three that can invoke func resolve with whatever it returns, so an
	// async func can be awaited through them.  flush() and flushOrNext()
	// resolve with undefined when there was nothing to call.
export function debounce(
	func,
	wait)
{
	const waitingResolvers = [];
	let timeout;
	let exec;


		// the one place func is actually called, so that however we got here --
		// the timer, now(), or flush() -- a call always settles anyone waiting
		// on it and leaves no scheduled call behind
	function run(
		args)
	{
		const result = func(...args);

			// take the resolvers rather than copying them, so the cancel() below
			// doesn't then settle the same promises again with undefined
		waitingResolvers.splice(0).forEach((resolve) => resolve(result));
		debouncedFunc.cancel();

		return result;
	}


	const debouncedFunc = (...args) => {
		exec = () => run(args);

		clearTimeout(timeout);

		if (waitingResolvers.length) {
				// flushOrNext() is waiting on a call, and this is it
			exec();
		} else {
			timeout = setTimeout(exec, wait);
		}
	};


	debouncedFunc.cancel = () => {
		clearTimeout(timeout);
		timeout = null;
		exec = null;

			// settle anyone waiting on a call that's now never going to happen,
			// rather than leaving them pending forever
		waitingResolvers.splice(0).forEach((resolve) => resolve(undefined));
	};


	debouncedFunc.now = (...args) => Promise.resolve(run(args));


	debouncedFunc.flush = () => Promise.resolve(exec ? exec() : undefined);


	debouncedFunc.flushOrNext = () => {
		if (exec) {
			return Promise.resolve(exec());
		}

			// nothing is scheduled, so hand back a promise that resolves with
			// the result of the next call.  leaving the resolver in the queue is
			// also what tells debouncedFunc() to run that call immediately
			// instead of waiting.
		const { promise, resolve } = Promise.withResolvers();

		waitingResolvers.push(resolve);

		return promise;
	};


	return debouncedFunc;
}
