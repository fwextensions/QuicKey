define(function() {
	function Mutex(
		promiseConstructor)
	{
		this._locked = false;
		this._queue = [];
		this._promiseConstructor = promiseConstructor || Promise;
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
			var next = this._queue.shift();

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
			var task = record[0],
				resolve = record[1],
				reject = record[2];

			task().then(resolve, reject).then(function() {
				this._dequeue();
			}.bind(this));
		}
	});


	return Mutex;
});
