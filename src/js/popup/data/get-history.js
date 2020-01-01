define([
	"./add-urls",
	"cp"
], function(
	addURLs,
	cp
) {
	const RequestedItemCount = 2000;
	const LoopItemCount = 1000;


	const loop = fn => fn().then(val => (val === true && loop(fn)) || val);


	return function getHistory()
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

							if (!(item.url in urls)) {
								lastItem = urls[item.url] = item;
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
