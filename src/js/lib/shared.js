export default function(
	key,
	init)
{
	return typeof init == "function" ? init() : init;
};
