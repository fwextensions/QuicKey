define([
	"./add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	const PathSeparator = " / ";


	let bookmarks = [];
	let urls = {};
	let path = [];
	let showPaths = false;


	function processNodes(
		nodes)
	{
		nodes.forEach(node => {
			const {url, children, title, parentId} = node;

				// don't return any duplicate URLs
			if (url && !urls[url]) {
				addURLs(node);
				urls[url] = true;

				if (showPaths && path.length) {
					node.title = path.join(PathSeparator) + PathSeparator + title;
				}

				bookmarks.push(node);
			} else if (children) {
				let titlePushed = false;

					// don't show the names of top-level bookmark folders
				if (showPaths && parentId && parentId !== "0" && title) {
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


	return function getBookmarks(
		showBookmarkPaths = false)
	{
		bookmarks = [];
		urls = {};
		path = [];
		showPaths = showBookmarkPaths;

		return cp.bookmarks.getTree()
			.then(bookmarkNodes => {
				processNodes(bookmarkNodes);
				urls = null;

				return bookmarks;
			});
	}
});
