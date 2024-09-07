import addURLs from "./add-urls";
import {addPinyin} from "./add-pinyin";


const PathSeparator = " / ";


let bookmarks = [];
let urls = {};
let path = [];
let showPaths = false;
let addPinyinStrings = false;


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

			if (addPinyinStrings) {
				addPinyin(node);
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


export default function getBookmarks(
	showBookmarkPaths,
	usePinyin)
{
	bookmarks = [];
	urls = {};
	path = [];
	showPaths = showBookmarkPaths;
	addPinyinStrings = usePinyin;

	return chrome.bookmarks.getTree()
		.then(bookmarkNodes => {
			processNodes(bookmarkNodes);
			urls = null;

			return bookmarks;
		});
}
