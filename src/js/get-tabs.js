define([
	"add-urls",
	"cp",
	"lodash"
], function(
	addURLs,
	cp,
	_
) {
	return function getTabs()
	{
		return Promise.all([
			cp.tabs.query({}),
			cp.tabs.query({
				active: true,
				currentWindow: true
			})
		])
			.then(function(result) {
				var tabs = result[0],
					activeTab = result[1][0];

					// remove the active tab from the array so it doesn't show up in
					// the results, making it clearer if you have duplicate tabs open
				_.remove(tabs, { id: activeTab.id });

				tabs.forEach(function(tab) {
					addURLs(tab);
				});

				return tabs;
			});
	}
});
