export default function objectsHaveSameKeys(
	object1,
	object2,
	checkDeeply)
{
	const keys1 = Object.keys(object1).sort();
	const keys2 = Object.keys(object2).sort();

	if (keys1.join() !== keys2.join()) {
		return false;
	} else {
		return keys1.every(key => {
			const value1 = object1[key];
			const value2 = object2[key];
			const type1 = typeof value1;
			const type2 = typeof value2;

			if (type1 !== type2) {
				return false;
			} else if (type1 == "object") {
				return (
					(!value1 && !value2) ||
					(Array.isArray(value1) && Array.isArray(value2)) ||
					(value1 && value2 &&
						(!checkDeeply || objectsHaveSameKeys(value1, value2, checkDeeply))) ||
					false
				);
			} else {
				return true;
			}
		});
	}
}
