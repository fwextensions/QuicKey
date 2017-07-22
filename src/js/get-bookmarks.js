define([
	"cp"
], function(
	cp
) {
	const ProtocolPattern = /^.+:\/\//;


	var bookmarks = [];


	function processNodes(
		nodes)
	{
		nodes.forEach(function(node) {
			if (node.url) {
				node.displayURL = node.url.replace(ProtocolPattern, "");
				bookmarks.push(node);
			} else if (node.children) {
				processNodes(node.children);
			}
		});
	}


	function getBookmarks()
	{
		bookmarks = [];

		return cp.bookmarks.getTree()
			.then(function(bookmarkNodes) {
				processNodes(bookmarkNodes);

				return bookmarks;
			});
	}


	return getBookmarks;
});
