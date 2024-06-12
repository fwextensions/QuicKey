export default class Mutex {
	constructor()
	{
		this._queue = [];
		this._locked = false;
		this.id = 0;
	}

	lock(
		task)
	{
//(this._queue.length || this._locked) && console.warn("mutex queue", this._queue.length);
console.log("MUTEX lock", this._locked, this._queue.length);

		return new Promise((resolve, reject) => {
			this._queue.push([task, resolve, reject, this.id++]);

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
		const [task, resolve, reject, id] = record;
console.warn("▼▼▼▼ MUTEX _execute", id, this._queue.length);

		Promise.resolve(task())
//			.then((data) => {
//console.warn("MUTEX TASK DONE", id, this._queue.length);
//				return data;
//			})
			.then(resolve, reject)
			.finally(() => {
console.warn("▲▲▲▲ MUTEX finally", id, this._queue.length);
				this._dequeue();
			});
//			.finally(() => this._dequeue());
	}
}
