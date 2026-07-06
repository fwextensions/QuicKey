const LockName = "__control__";

let isHeld = false;
const heldCallbacks = [];

function notifyHeld()
{
	for (const callback of heldCallbacks) {
		try {
			callback();
		} catch (e) {
			console.error(e);
		}
	}
}

	// register a callback that will be fired when this context takes control.
	// if control is already held, the callback fires immediately.
function onHeld(
	callback)
{
	if (isHeld) {
		callback();
	} else {
		heldCallbacks.push(callback);
	}
}

function claimWhenAvailable(
	name,
	task)
{
	if (typeof name === "function") {
		task = name;
		name = LockName;
	}

	return navigator.locks.request(name, (lock) => {
			// make sure this is set before calling the task, in case that checks
			// whether the lock is held
		isHeld = true;

			// don't put try/catch around this, since we want to release the lock
			// if something goes wrong
		const result = task(lock);

			// fire the onHeld callbacks after the task, so anything the task
			// sets up is available when queued events are replayed
		notifyHeld();

		if (typeof result?.then === "function") {
				// the task returned a promise, so it controls how long this
				// context keeps the lock.  clear isHeld when it settles.
			return result.finally(() => isHeld = false);
		}

			// the caller wants to keep control until the process exits
		return new Promise(() => {});
	});
}

export default {
	claimWhenAvailable,
	onHeld,
	isHeld: () => isHeld
}
