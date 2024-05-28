function Mutex(
	promiseConstructor = Promise)
{
	this._locked = false;
	this._queue = [];
	this._promiseConstructor = promiseConstructor;
}


Object.assign(Mutex.prototype, {
	lock: function(
		task)
	{
		return new this._promiseConstructor(function(resolve, reject) {
			this._queue.push([task, resolve, reject]);

			if (!this._locked) {
				this._dequeue();
			}
		}.bind(this));
	},


	_dequeue: function()
	{
		const next = this._queue.shift();

		if (next) {
			this._locked = true;
			this._execute(next);
		} else {
			this._locked = false;
		}
	},


	_execute: function(
		record)
	{
		const [task, resolve, reject] = record;

		task().then(resolve, reject).then(function() {
			this._dequeue();
		}.bind(this));
	}
});


export default Mutex;
