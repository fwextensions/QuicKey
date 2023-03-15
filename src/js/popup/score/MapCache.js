export class MapCache {
	constructor(
		maxSize = 0,
		defaultEntries = [])
	{
		this.cache = new Map();
		this.maxSize = maxSize;

			// we ignore the maxSize when adding the default entries
		for (const [key, value] of defaultEntries) {
			this.cache.set(key, value);
		}
	}

	get(
		key,
		creator,
		...args)
	{
		let value;

		if (this.cache.has(key)) {
			value = this.cache.get(key);
			this.cache.delete(key);
			this.cache.set(key, value);
		} else if (typeof creator === "function") {
			value = creator(key, ...args);
			this.cache.set(key, value);
		}

		return value;
	}

	set(
		key,
		value)
	{
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
