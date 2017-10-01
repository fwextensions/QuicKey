define([
	"add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	return function getTabs()
	{
		return cp.tabs.query({})
			.then(function(tabs) {
				tabs.forEach(function(tab) {
					addURLs(tab);
				});

				return tabs;
			});
	}
});
