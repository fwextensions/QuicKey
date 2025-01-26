import control from "@/shared/control";

const controlledListeners = new Map();

	// walk down the dot path specified in name, starting from chrome
const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);

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

export {
	addListener,
	removeListener,
	addListeners,
	removeListeners,
};
