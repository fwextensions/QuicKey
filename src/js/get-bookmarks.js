define([
	"add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	var bookmarks = [],
		urls = {};


	function processNodes(
		nodes)
	{
		nodes.forEach(function(node) {
			var url = node.url;

				// don't return any duplicate URLs
			if (url && !urls[url]) {
				addURLs(node);
				urls[url] = true;
				bookmarks.push(node);
			} else if (node.children) {
				processNodes(node.children);
			}
		});
	}


	return function getBookmarks()
	{
		bookmarks = [];
		urls = {};

		return cp.bookmarks.getTree()
			.then(function(bookmarkNodes) {
				processNodes(bookmarkNodes);
				urls = null;

				return bookmarks;
			});
	}
});
