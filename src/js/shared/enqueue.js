	// run task after the previous one in a queue settles, and return the new
	// tail of the queue.  the tail never rejects: a rejected tail would skip the
	// then() handlers of every task queued after it, and re-report the same
	// error through each finally().  so the failure is handed to onError here,
	// once, instead.  attaching this catch() also marks the rejection handled,
	// so the global unhandledrejection listener never sees it -- onError is the
	// only report it gets.
export function enqueue(
	tail,
	task,
	onError)
{
	return tail
		.then(task)
		.catch(onError);
}
