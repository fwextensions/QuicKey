import control from "@/shared/control";

const controlledListeners = new Map();

	// walk down the dot path specified in name, starting from chrome
const getEvent = (name) => name.split(".").reduce((res, key) => res[key], chrome);

function createControlledListener(
	listener,
	name)
{
	if (controlledListeners.has(listener)) {
		return controlledListeners.get(listener);
	} else {
		const controlledListener = (...eventArgs) => {
			if (control.isHeld()) {
//console.log("========== calling listener", name);
				return listener(...eventArgs);
			}
//console.log("========== IGNORING listener", name);
		};

		controlledListeners.set(listener, controlledListener);

		return controlledListener;
	}
}

function addListener(
	name,
	listener)
{
	getEvent(name).addListener(createControlledListener(listener, name));
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

function addListeners(
	listeners)
{
	if (listeners && typeof listeners === "object") {
		listeners = Object.entries(listeners);
	}

	for (const [name, listener] of listeners) {
		addListener(name, listener);
	}
}

function removeListeners(
	listeners)
{
	if (listeners && typeof listeners === "object") {
		listeners = Object.entries(listeners);
	}

	for (const [name, listener] of listeners) {
		removeListener(name, listener);
	}
}

export {
	addListener,
	removeListener,
	addListeners,
	removeListeners,
};
