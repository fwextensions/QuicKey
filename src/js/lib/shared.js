define(function() {
	return function(
		key,
		init)
	{
		const background = chrome.extension.getBackgroundPage();
		const shared = background.shared || (background.shared = {});

		return shared[key] || (shared[key] = (typeof init == "function" ? init() : init));
	};
});
