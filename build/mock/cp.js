define([
	"bluebird"
], function(
	Promise
) {
	function promiseNoop()
	{
		return Promise.resolve([]);
	}


	global.chrome = {
		runtime: {
			id: "ldlghkoiihaelfnggonhjnfiabmaficg"
		},
		extension: {
			getBackgroundPage: () => ({})
		}
	};


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
		windows: {
			getAll: promiseNoop
		},
		sessions: {
			getRecentlyClosed: promiseNoop
		},
		commands: {
			getAll: () => Promise.resolve([{ name: "_execute_browser_action" }])
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
