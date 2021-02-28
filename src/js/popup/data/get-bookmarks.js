define([
	"./add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	const PathConnector = " / ";


	let bookmarks = [];
	let urls = {};
	let path = [];


	function processNodes(
		nodes)
	{
		nodes.forEach(node => {
			const {url, children, title, parentId} = node;

				// don't return any duplicate URLs
			if (url && !urls[url]) {
				addURLs(node);
				urls[url] = true;

				if (path.length) {
					node.title = path.join(PathConnector) + PathConnector + title;
				}

				bookmarks.push(node);
			} else if (children) {
				let titlePushed = false;

				if (parentId && parentId !== "0" && title) {
					path.push(node.title);
					titlePushed = true;
				}

				processNodes(children);

				if (titlePushed) {
					path.pop();
				}
			}
		});
	}


	return function getBookmarks()
	{
		bookmarks = [];
		urls = {};
		path = [];

		return cp.bookmarks.getTree()
			.then(bookmarkNodes => {
				processNodes(bookmarkNodes);
				urls = null;

				return bookmarks;
			});
	}
});
