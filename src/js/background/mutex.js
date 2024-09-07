export default class Mutex {
	constructor()
	{
		this._queue = [];
		this._locked = false;
		this.id = 0;
	}

	lock(
		task,
		timeLimit = 2000)
	{
//console.log("MUTEX lock", this.id, this._locked, this._queue.length);

		return new Promise((resolve, reject) => {
			this._queue.push([task, resolve, reject, this.id++, timeLimit]);

			if (!this._locked) {
				this._dequeue();
			}
		});
	}

	_dequeue()
	{
		const next = this._queue.shift();

		if (next) {
			this._locked = true;
			this._execute(next);
		} else {
			this._locked = false;
		}
	}

	_execute(
		record)
	{
		const [task, resolve, reject, id, timeLimit] = record;
		let timeout;
//console.warn("▼▼▼▼ MUTEX _execute", id, this._queue.length);

			// execute the task and race it against a timeout, so that if the
			// task doesn't complete (most likely because the other end of a
			// message pipe got closed), we can finish this task and move on to
			// the next one instead of blocking all storage tasks
		Promise.race([
			Promise.resolve(task()),
			new Promise((resolve) => {
				timeout = setTimeout(
					() => {
DEBUG && console.error("MUTEX timed out, id:", id, "queue:", this._queue.length, new Date().toLocaleString(), String(task).slice(0, 100));
						resolve(new Error("Mutex task timed out")); },
//					() => resolve(new Error("Mutex task timed out")),
					timeLimit
				);
			}),
		])
			.then(resolve, reject)
			.finally(() => {
//console.warn("▲▲▲▲ MUTEX finally", id, this._queue.length);

					// though not strictly necessary, clean up the timeout here
				clearTimeout(timeout);
				this._dequeue();
			});
	}
}
