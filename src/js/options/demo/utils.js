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

export function rndGradientValues()
{
	return [
		rnd(0, 360),
		rndHSLA(0, rnd(50, 70, true), rnd(80, 95, true)),
		rndHSLA(0, rnd(60, 80, true), rnd(70, 80, true))
	];
}

export function rndGradient()
{
	return linearGradient(...rndGradientValues());
}
