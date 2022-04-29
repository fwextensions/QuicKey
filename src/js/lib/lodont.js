define(() => {
	function pull(
		array,
		value)
	{
		let fromIndex = 0;

		while((fromIndex = array.indexOf(value, fromIndex)) > -1) {
			array.splice(fromIndex, 1);
		}

		return array;
	}


	function remove(
		array,
		predicateArg)
	{
		let predicate;

		if (typeof predicateArg === "function") {
			predicate = predicateArg;
		} else if (typeof predicateArg === "object" && predicateArg) {
			const entries = Object.entries(predicateArg);

			predicate = (item) => typeof item === "object" && item &&
				entries.reduce((result, [key, value]) => result && item[key] === value, true);
		} else {
			predicate = (item) => Object.is(item, predicateArg);
		}

		const toRemove = [];
		const result = array.filter((item, i) => predicate(item) && toRemove.push(i));

		toRemove.reverse().forEach(i => array.splice(i, 1));

		return result;
	}


	function dropRightWhile(
		array,
		predicate)
	{
		let index = array.length;

		while (index-- && predicate(array[index], index, array)) {
			// empty loop to increment index
		}

		return array.slice(0, index + 1);
	}


	function last(
		array)
	{
		const length = array == null ? 0 : array.length;

		return length ? array[length - 1] : undefined;
	}


	function toPairs(
		object)
	{
		return Object.entries(object);
	}


	return {
		pull,
		remove,
		dropRightWhile,
		last,
		toPairs
	};
});
