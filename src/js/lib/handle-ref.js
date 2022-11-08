export default function handleRef(
		refName)
	{
		return function(
			ref)
		{
			this[refName] = ref;
		};
	};
