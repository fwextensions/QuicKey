import { MapCache } from "@/popup/score/MapCache";

const SyntaxPattern = /[\^$\\.*+?()[\]{}|]/g;
const DefaultSingleCharRegexes = [
	..."abcdefghijklmnopqrstuvwxyz",
	..."0123456789",
	...",./<>?;':\"[]\\{}|`~!@#$%^&*()-=_+"
].map((char) => [char, createRegexCI(char)]);

	// precache the alphabet and other common single chars
const singleCharCache = new MapCache(0, DefaultSingleCharRegexes);
const multiCharCache = new MapCache(1000);
// TODO: this maxSize should maybe be Math.pow(2, 16) to match maxIterations, which is much larger

function createRegexCI(
	searchString)
{
	return new RegExp(searchString.replace(SyntaxPattern, "\\$&"), "i");
}

export function indexOfCI(
	string,
	searchString)
{
	const cache = searchString.length === 1
		? singleCharCache
		: multiCharCache;
	const regex = cache.get(searchString, createRegexCI);

	return string.search(regex);
}
