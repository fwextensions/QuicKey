import { useCallback, useEffect, useRef, useState } from "react";

export default function useStepper(
	callback,
	options = {})
{
	const {
		from = 0,
		to,
		step = 1,
		delay = 1000
	} = options;
	const [index, setIndex] = useState(from);
	const savedCallback = useRef(callback);
	const interval = useRef();

	const handleStep = useCallback(() => setIndex((index) => {
		if (index > to || index === null) {
			clearInterval(interval.current);

			return null;
		} else {
			savedCallback.current(index);

			return index + step;
		}
	}), [from, to, step]);

	useEffect(() => {
			// call the callback immediately, so the component gets the first
			// index without any delay.  then clear any existing interval and
			// start a new one.
		handleStep();
		clearInterval(interval.current);
		interval.current = setInterval(handleStep, delay);

		return () => clearInterval(interval.current);
	}, [handleStep, delay]);
}
