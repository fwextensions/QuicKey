export class MapCache {
	constructor(
		maxSize = 0,
		defaultEntries = [])
	{
		this.cache = new Map(defaultEntries);
		this.maxSize = maxSize;
	}

	get(
		key,
		creator,
		...args)
	{
		let value;

		if (this.cache.has(key)) {
				// every time we get a cache hit, move that key to the end of the
				// keys array, so it won't get removed when we hit the max size
			value = this.cache.get(key);
			this.cache.delete(key);
			this.cache.set(key, value);
		} else if (typeof creator === "function") {
				// the key doesn't exist, so create the value and store it
			value = creator(key, ...args);
			this.cache.set(key, value);
		}

		return value;
	}

	set(
		key,
		value)
	{
			// delete the key so when we set the key/value below it becomes the
			// most recently added, keeping it in the cache
		this.cache.delete(key);

		if (this.maxSize && this.cache.size >= this.maxSize) {
			this.cache.delete(this.cache.keys().next().value);
		}

		this.cache.set(key, value);
	}

	has(
		key)
	{
		return this.cache.has(key);
	}

	delete(
		key)
	{
		return this.cache.delete(key);
	}

	clear()
	{
		return this.cache.clear();
	}
}
