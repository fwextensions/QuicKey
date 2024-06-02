export default class Mutex {
	constructor()
	{
		this._queue = [];
		this._locked = false;
	}

	lock(
		task)
	{
		return new Promise((resolve, reject) => {
			this._queue.push([task, resolve, reject]);

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
		const [task, resolve, reject] = record;

		Promise.resolve(task())
			.then(resolve, reject)
			.finally(() => this._dequeue());
	}
}
