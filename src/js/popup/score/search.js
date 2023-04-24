import { MapCache } from "@/popup/score/MapCache";

const SyntaxPattern = /[\^$\\.*+?()[\]{}|]/g;
const LowercaseString = "abcdefghijklmnopqrstuvwxyzàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿāăąćĉċčďđēĕėęěĝğġģĥħĩīĭįıĳĵķĺļľŀłńņňŋōŏőœŕŗřśŝşšţťŧũūŭůűųŵŷźżžƃƅƈƌƒƙơƣƥƨƭưƴƶƹƽǆǉǌǎǐǒǔǖǘǚǜǟǡǣǥǧǩǫǭǯǳǵǻǽǿȁȃȅȇȉȋȍȏȑȓȕȗɓɔɗɘəɛɠɣɨɩɯɲɵʃʈʊʋʒḁḃḅḇḉḋḍḏḑḓḕḗḙḛḝḟḡḣḥḧḩḫḭḯḱḳḵḷḹḻḽḿṁṃṅṇṉṋṍṏṑṓṕṗṙṛṝṟṡṣṥṧṩṫṭṯṱṳṵṷṹṻṽṿẁẃẅẇẉẋẍẏẑẓẕạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ";
const AlphaRegexes = [
	...LowercaseString,
	...LowercaseString.toLocaleUpperCase(),
].map((char) => [char, createRegexCI(char)]);

	// precache the alphabet and other common single chars
const singleAlphaCache = new MapCache(0, AlphaRegexes);
const multiCharCache = new MapCache(1000);
// TODO: this maxSize should maybe be Math.pow(2, 16) to match maxIterations, which is much larger

function createRegexCI(
	searchString)
{
	return new RegExp(searchString.replace(SyntaxPattern, "\\$&"), "i");
}

export function search(
	string,
	searchString)
{
	const regex = searchString.length === 1
		? singleAlphaCache.get(searchString)
		: multiCharCache.get(searchString, createRegexCI);

	if (regex) {
		return string.search(regex);
	} else {
			// if we don't have a regex, it means the query is a single-char
			// string that doesn't have an uppercase version, so we can just
			// use indexOf()
		return string.indexOf(searchString);
	}
}
