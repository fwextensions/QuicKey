define(function() {
	const background = chrome.extension.getBackgroundPage();
	const shared = background.shared || (background.shared = {});


	return function(
		key,
		init)
	{
		return shared[key] || (shared[key] = (typeof init == "function" ? init() : init));
	};
});
