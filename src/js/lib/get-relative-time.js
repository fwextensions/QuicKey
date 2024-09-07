const DaySeconds = 60 * 60 * 24;
const Units = [
  ["second", 1],
  ["minute", 60],
  ["hour", 60 * 60],
  ["day", DaySeconds],
  ["week", DaySeconds * 7],
  ["month", DaySeconds * 30],
  ["year", DaySeconds * 365],
];

const relativeTime = new Intl.RelativeTimeFormat(
	navigator.language || "en",
	{
		numeric: "auto",
		style: "short"
	}
);

export function getRelativeTime(
	date)
{
	if (!date) {
		return "";
	}

		// allow dates or times to be passed
	const timeMs = typeof date === "number" ? date : date.getTime();
	const delta = Math.ceil((timeMs - Date.now()) / 1000);
	const deltaAbs = Math.abs(delta);
		// get the longest unit that is smaller than our delta, so we can divide
		// that into the delta in seconds to get a whole number of units
	const [unit, length] = Units.findLast(([, length]) => deltaAbs >= length) || Units[0];

	return relativeTime.format(Math.round(delta / length), unit);
}
