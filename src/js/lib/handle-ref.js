define(function() {
	return function handleRef(
			refName)
		{
			return function(
				ref)
			{
				this[refName] = ref;
			};
		};
});
