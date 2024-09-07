export default function handleRef(
	refName,
	self)
{
	return function(
		ref)
	{
		self[refName] = ref;
	};
};
