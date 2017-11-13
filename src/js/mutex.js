define(function() {
	function Mutex() {
	  this._busy  = false;
	  this._queue = [];
	}

	Object.assign(Mutex.prototype, {
		synchronize: function(task) {
			return new Promise(function(resolve, reject) {
				this._queue.push([task, resolve, reject]);

				if (!this._busy) {
					this._dequeue();
				}
			}.bind(this));
		},

		_dequeue: function() {
			var next = this._queue.shift();

			if (next) {
				this._busy = true;
				this._execute(next);
			} else {
				this._busy = false;
			}
		},

		_execute: function(record) {
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
