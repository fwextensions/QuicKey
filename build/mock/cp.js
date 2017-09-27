define(function() {
	return {
		management: {
			getSelf: function()
			{
				return {
					then: function(
						cb)
					{
						cb({});
					}
				}
			}
		},

		tabs: {
			query: function() {}
		}
	};
});
