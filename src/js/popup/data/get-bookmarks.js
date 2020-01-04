define([
	"./add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	let bookmarks = [];
	let urls = {};


	function processNodes(
		nodes)
	{
		nodes.forEach(node => {
			const {url, children} = node;

				// don't return any duplicate URLs
			if (url && !urls[url]) {
				addURLs(node);
				urls[url] = true;
				bookmarks.push(node);
			} else if (children) {
				processNodes(children);
			}
		});
	}


	return function getBookmarks()
	{
		bookmarks = [];
		urls = {};

		return cp.bookmarks.getTree()
			.then(bookmarkNodes => {
				processNodes(bookmarkNodes);
				urls = null;

				return bookmarks;
			});
	}
});
