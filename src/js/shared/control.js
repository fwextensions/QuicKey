const LockName = "__control__";

const logColor = (color) => (highlight, ...rest) => console.log("%c" + highlight, `background: ${color}`, ...rest);
const orange = logColor("orange");
const locked = logColor("pink");
const unlocked = logColor("lightgreen");
let isHeld = false;

async function isLockHeld(
	lockName)
{
	const locks = await navigator.locks.query();
console.log("--------- locks", globalThis.location.pathname, locks);

	return locks.held.some(({ name }) => name === lockName);
}

async function claimWhenAvailable(
	name,
	task)
{
	if (typeof name === "function") {
		task = name;
		name = LockName;
	}

	const lockHeld = await isLockHeld(LockName);

	lockHeld
		? locked("--------- LOCK HELD", globalThis.location.pathname)
		: unlocked("--------- LOCK AVAILABLE", globalThis.location.pathname);

	return navigator.locks.request(name, async (lock) => {
			// make sure this is set before calling the task, in case that checks
			// whether the lock is held
		isHeld = true;

orange("--------- GOT LOCK", globalThis.location.pathname, lock?.mode, lock?.name);
			// don't put try/catch around this, since we want to release the lock
			// if something goes wrong
		const result = await task();

		if (typeof result?.then === "function") {
			return result;
		}

			// the caller wants to keep control until the process exits
		return new Promise(() => {});
	});
}

export default {
	claimWhenAvailable,
	isHeld: () => isHeld
}
