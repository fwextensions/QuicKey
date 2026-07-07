	// an in-memory implementation of the Web Locks API (navigator.locks) good
	// enough to model QuicKey's two uses: the storage mutex ("storage://…") and
	// the exclusive "__control__" lock that arbitrates which context handles
	// commands.  it supports the exclusive mode only, honors the queuing
	// semantics the real API guarantees (one holder at a time, FIFO grant when
	// the holder's callback settles), and implements query() so isLockHeld-style
	// checks work.  ifAvailable and shared mode are not needed and are omitted.

export function createLocksFake()
{
		// name -> { held: entry|null, queue: [entry] }
	const locksByName = new Map();

	function getLock(
		name)
	{
		if (!locksByName.has(name)) {
			locksByName.set(name, { held: null, queue: [] });
		}

		return locksByName.get(name);
	}

	function grantNext(
		name)
	{
		const lock = getLock(name);

		if (lock.held || lock.queue.length === 0) {
			return;
		}

		const entry = lock.queue.shift();

		lock.held = entry;

		const lockInfo = { name, mode: "exclusive" };
		let result;

		try {
			result = entry.callback(lockInfo);
		} catch (error) {
				// the callback threw synchronously: release and propagate
			release(name, entry);
			entry.reject(error);

			return;
		}

			// the lock is held until the callback's returned promise settles
		Promise.resolve(result)
			.then(
				(value) => {
					release(name, entry);
					entry.resolve(value);
				},
				(error) => {
					release(name, entry);
					entry.reject(error);
				}
			);
	}

	function release(
		name,
		entry)
	{
		const lock = getLock(name);

		if (lock.held === entry) {
			lock.held = null;
				// grant the next waiter on a microtask, matching the real API's
				// asynchronous hand-off rather than recursing synchronously
			Promise.resolve().then(() => grantNext(name));
		}
	}

	const locks = {
		request(
			name,
			optionsOrCallback,
			maybeCallback)
		{
			const callback = typeof optionsOrCallback === "function"
				? optionsOrCallback
				: maybeCallback;

			if (typeof callback !== "function") {
				return Promise.reject(new TypeError("A lock callback is required."));
			}

			return new Promise((resolve, reject) => {
				const entry = { callback, resolve, reject };

				getLock(name).queue.push(entry);
					// grant on a microtask so that synchronous back-to-back
					// requests queue in call order before any is granted
				Promise.resolve().then(() => grantNext(name));
			});
		},

		query()
		{
			const held = [];
			const pending = [];

			for (const [name, lock] of locksByName) {
				if (lock.held) {
					held.push({ name, mode: "exclusive" });
				}

				for (let i = 0; i < lock.queue.length; i++) {
					pending.push({ name, mode: "exclusive" });
				}
			}

			return Promise.resolve({ held, pending });
		},
	};

	return locks;
}
