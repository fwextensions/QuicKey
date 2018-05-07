define([
	"bluebird"
], function(
	Promise
) {
	function promiseNoop()
	{
		return Promise.resolve([]);
	}


	return {
		management: {
			getSelf: function()
			{
				return Promise.resolve({});
			}
		},
		tabs: {
			query: promiseNoop
		},
		sessions: {
			getRecentlyClosed: promiseNoop
		},
		storage: {
			local: {
				get: promiseNoop,
				set: promiseNoop,
				clear: promiseNoop
			}
		}
	};
});
