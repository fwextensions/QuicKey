import control from "@/shared/control";

const controlledListeners = new Map();

	// events that arrive before this context has taken control are queued and
	// replayed when the lock is granted, so that a command that lands in the
	// gap between the old controller dying and this context taking over isn't
	// silently dropped.  if another context has control, it will have received
	// these same events directly, and the copies queued here will simply
	// expire.  events older than this age are stale and are never replayed.
const MaxQueuedEventAge = 1000;
const MaxQueuedEvents = 50;

let queuedEvents = [];

	// walk down the dot path specified in name, starting from chrome
const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);

function pruneQueuedEvents()
{
	const cutoff = Date.now() - MaxQueuedEventAge;

	queuedEvents = queuedEvents.filter(({ time }) => time > cutoff)
		.slice(-MaxQueuedEvents);
}

function createControlledListener(
	listener)
{
	if (controlledListeners.has(listener)) {
		return controlledListeners.get(listener);
	} else {
		const controlledListener = (...eventArgs) => {
			if (control.isHeld()) {
				return listener(...eventArgs);
			}

				// we don't have control yet, so queue the event.  if we're
				// granted the lock shortly, it'll be replayed; otherwise,
				// it'll expire out of the queue.
			pruneQueuedEvents();
			queuedEvents.push({ listener, eventArgs, time: Date.now() });
		};

		controlledListeners.set(listener, controlledListener);

		return controlledListener;
	}
}

function addListener(
	name,
	listener)
{
	getEvent(name).addListener(createControlledListener(listener));
}

function removeListener(
	name,
	listener)
{
	const controlledListener = controlledListeners.get(listener);

	if (controlledListener) {
		getEvent(name).removeListener(controlledListener);
		controlledListeners.delete(listener);
	}
}

function processListeners(
	listeners,
	func)
{
	if (!listeners) {
		return;
	}

	if (typeof listeners === "object") {
		listeners = Object.entries(listeners);
	}

	for (const [name, listener] of listeners) {
		func(name, listener);
	}
}


function addListeners(
	listeners)
{
	processListeners(listeners, addListener);
}

function removeListeners(
	listeners)
{
	processListeners(listeners, removeListener);
}

	// when this context takes control, replay any fresh events that arrived
	// while our lock request was still pending
control.onHeld(() => {
	pruneQueuedEvents();

	const events = queuedEvents;

	queuedEvents = [];

	for (const { listener, eventArgs } of events) {
		listener(...eventArgs);
	}
});

export {
	addListener,
	removeListener,
	addListeners,
	removeListeners,
};
