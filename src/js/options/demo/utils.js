const StartingHue = rnd(0, 360, true);
const HueJitter = 5;

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
	const hueStep = Math.floor(360 / tabCount);

	if (tabs.length > tabCount) {
		tabs.length = tabCount;
	} else {
		for (let i = tabs.length; i < tabCount; i++) {
				// make sure the hues used for the gradients are spread roughly
				// evenly around the color wheel from each other
			const hue1 = StartingHue + hueStep * i;
			const hue2 = StartingHue + hueStep * i + hueStep * tabCount / 3;
			const gradient = rndGradientValues(
				[hue1 - HueJitter, hue1 + HueJitter],
				[hue2 - HueJitter, hue2 + HueJitter]
			);

			tabs.push({
				id: i,
				length: rnd(20, 80, true),
				favicon: gradient[2],
				gradient: linearGradient(...gradient)
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
	const { screenLeft: left, screenTop: top, outerWidth: width, outerHeight: height } = targetWindow;

	return { left, top, width, height };
}

export function linearGradient(
	angle,
	color1,
	color2)
{
	return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
}

export function rnd(
	min = 0,
	max = 1,
	floor = false)
{
	let value = Math.random() * (max - min) + min;

	if (floor) {
		value = Math.floor(value);
	}

	return value;
}

export function rndHSLA(
	hueRange,
	saturation = 60,
	lightness = 80,
	alpha = 1)
{
	let hueMin = 0;
	let hueMax = 360;

	if (Array.isArray(hueRange)) {
		[hueMin, hueMax] = hueRange;
	}

	const hue = rnd(hueMin, hueMax, true) % 360;

	return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

export function rndGradientValues(
	hueRange = [0, 360],
	hueRange2 = [0, 360])
{
	return [
		rnd(0, 360, true),
		rndHSLA(hueRange, rnd(50, 70, true), rnd(80, 95, true)),
		rndHSLA(hueRange2, rnd(60, 80, true), rnd(70, 80, true))
	];
}

export function rndGradient()
{
	return linearGradient(...rndGradientValues());
}
