define([
	"lib/load-script"
], function(
	loadScript
) {
	let pinyinLoaded = false;
	let pinyinError;


	async function loadPinyin()
	{
		if (!pinyinLoaded && !pinyinError) {
			try {
					// dynamically load the pinyin module into a global var, so
					// that it's only processed if we actually need to use it.
					// importing it as a global is ugly, but seems to be the
					// simplest solution, since a built RequireJS project can't
					// seem to do lazy-loading without including the full
					// RequireJS library, which adds extra bloat.
				await loadScript("/js/lib/pinyin.js");

					// set a flag so we know pinyin() is available and we don't
					// have to check typeof pinyin on every tab in the loop below
				pinyinLoaded = typeof pinyin == "function";
			} catch (error) {
				pinyinError = error;
				console.error(error);
			}
		}

		return pinyinLoaded;
	}


	function addPinyin(
		item)
	{
		if (pinyinLoaded) {
			const pinyinTitle = pinyin(item.title);
			const pinyinDisplayURL = pinyin(item.displayURL);

				// if there's no difference, just store an empty
				// string that scoreArray() will use to short-circuit
				// the scoring and return 0
			item.pinyinTitle = (pinyinTitle !== item.title)
				? pinyinTitle
				: "";
			item.pinyinDisplayURL = (pinyinDisplayURL !== item.displayURL)
				? pinyinDisplayURL
				: "";
		}

		return item;
	}


	return {
		loadPinyin,
		addPinyin
	};
});
