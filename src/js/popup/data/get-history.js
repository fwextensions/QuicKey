define([
	"cp",
	"lib/decode",
	"./add-urls",
	"./add-pinyin"
], function(
	cp,
	decode,
	addURLs,
	{addPinyin}
) {
	const RequestedItemCount = 2000;
	const LoopItemCount = 1000;
	const FilenamePattern = /([^/]*)\/([^/]+)?$/;


	const loop = fn => fn().then(val => (val === true && loop(fn)) || val);


	return function getHistory(
		usePinyin)
	{
		const ids = {};
		const urls = {};
		let count = 0;
		let lastItem = null;

		return loop(() => {
			const endTime = (lastItem && lastItem.lastVisitTime) || Date.now();

			return cp.history.search({
				text: "",
				startTime: 0,
				endTime: endTime,
				maxResults: LoopItemCount
			})
				.then(historyItems => {
					const initialCount = count;

					historyItems.forEach(item => {
						const {id} = item;

							// history will often return duplicate items
						if (!ids[id] && count < RequestedItemCount) {
							addURLs(item, true);

								// get the url after addURLs(), since that will
								// convert suspended URLs to unsuspended
							const {url, title} = item;

							if (!(url in urls)) {
								if (!title) {
									const match = url.match(FilenamePattern);

										// if there's no title on the history
										// item, it's probably a locally loaded
										// raw file.  so try to pull out the
										// filename or last folder in the URL,
										// and if that doesn't work, default to
										// the full URL as a title.
									item.title = decode((match && (match[2] || match[1])) || url);
								}

								if (usePinyin) {
									addPinyin(item);
								}

								lastItem = urls[url] = item;
								ids[id] = true;
								count++;
							}
						}
					});

						// only loop if we found some new items in the last call
						// and we haven't reached the limit yet
					if (count > initialCount && count < RequestedItemCount) {
						return true;
					} else {
						return Object.values(urls);
					}
				});
		});
	}
});
