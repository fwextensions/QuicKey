function rnd(
	min = 0,
	max = 1,
	floor = true)
{
	let value = Math.random() * (max - min) + min;

	if (floor) {
		value = Math.floor(value);
	}

	return value;
}

const rndDeg = () => rnd(0, 360);
const rndH = rndDeg;
const rndS = () => rnd(80, 95);
const rndL = () => rnd(30, 55);
const rndSDark = () => rnd(30, 65);
const rndSLight = () => rnd(60, 85);
const rndLDark = () => rnd(30, 55);
const rndLLight = () => rnd(60, 85);
const hsla = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

function generateTriadPalette(
	seed = [rndH(), rndS(), rndL()])
{
	const seedHue = seed[0];

	return [
		hsla(seedHue + 120, rndSDark(), rndLDark(), .6),
		hsla(seedHue + 120, rndSLight(), rndLLight(), .35),
		hsla(...seed, .6),
		hsla(seedHue - 120, rndSLight(), rndLLight(), .35),
		hsla(seedHue - 120, rndSDark(), rndLDark(), .6),
	];
}

function repeatingLinearGradient(
	deg,
	colors,
	{
		width = 1,
		widthUnit = "em",
		widthJitter = 0
	} = {})
{
	let currentWidth = 0;
	const gradientSteps = colors.reduce((result, color) => [
		...result,
		`${color} ${currentWidth}${widthUnit}`,
		`${color} ${currentWidth += (width + rnd(-widthJitter, widthJitter, false))}${widthUnit}`
	], []);

	return `repeating-linear-gradient(${deg}deg, ${gradientSteps.join(", ")})`;
}

function generatePlaidPattern()
{
	const colors = generateTriadPalette();
	const deg1 = rndDeg();
	const deg2 = deg1 + rnd(60, 120);

	return {
			// use the seed color as the favicon, since it should be the most obvious
		favicon: colors[2],
		background: `
background: 
	${repeatingLinearGradient(deg1, colors, { widthJitter: .5 })}, 
	${repeatingLinearGradient(deg2, colors, { widthJitter: .5 })};
font-size: ${rnd(12, 24)}px;	
`
	};
}

export function shuffle(
	array)
{
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}

	return array;
}

export function createTabs(
	tabCount,
	tabs = [])
{
	if (tabs.length > tabCount) {
		tabs.length = tabCount;
	} else {
		for (let i = tabs.length; i < tabCount; i++) {
			tabs.push({
				id: i,
				length: rnd(20, 65),
				...generatePlaidPattern()
			});
		}
	}

	return tabs;
}

export function createRecents(
	tabCount)
{
	return shuffle([...Array(tabCount).keys()]);
}

export function getWindowBounds(
	targetWindow = window)
{
	let { screenLeft: left, screenTop: top, outerWidth: width, outerHeight: height } = targetWindow;

		// make sure the window origin is relative to 0,0, in case the current
		// screen is to the left of the main one
	left -= screen.availLeft;
	top -= screen.availTop;

	return { left, top, width, height };
}
