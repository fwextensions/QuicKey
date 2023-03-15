const SyntaxPattern = /[\^$\\.*+?()[\]{}|]/g;
const RegexStackMaxLength = 1000;

const regexCache = new Map();
const regexStack = [];
// TODO: this should maybe be Math.pow(2, 16) to match maxIterations, which is much larger

	// precache the alphabet and then reset the stack so the letters don't count
	// against the max length and get deleted
[..."abcdefghijklmnopqrstuvwxyz"].map(getRegex);
regexStack.length = 0;

function createRegexCI(
	searchString)
{
	return new RegExp(searchString.replace(SyntaxPattern, "\\$&"), "i");
}

function getRegex(
	searchString)
{
	let regex = regexCache.get(searchString);

	if (!regex) {
		regex = createRegexCI(searchString);
		regexCache.set(searchString, regex);
		regexStack.push(searchString);

		if (regexStack.length > RegexStackMaxLength) {
			regexCache.delete(regexStack.shift());
		}
	}

	return regex;
}

export function indexOfCI(
	string,
	searchString)
{
	const regex = getRegex(searchString);

	return string.search(regex);
}
