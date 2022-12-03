import { useCallback, useEffect, useRef, useState } from "react";

export default function useStepper(
	callback,
	options = {})
{
	const {
		from = 0,
		to,
		step = 1,
		delay = 1000,
		autoStart = true
	} = options;
	const [index, setIndex] = useState(from);
	const callbackRef = useRef(callback);
	const interval = useRef();

	const handleStep = useCallback(() => setIndex((index) => {
		callbackRef.current(index);

		if (index >= to || index === null) {
			stop();

			return null;
		} else {
			return index + step;
		}
	}), [from, to, step]);

	const start = useCallback(() => {
		setIndex(from);

			// call the callback immediately, so the component gets the first
			// index without any delay.  then clear any existing interval and
			// start a new one.
		handleStep();
		stop();
		interval.current = setInterval(handleStep, delay);
	}, [from, handleStep, delay]);

	const stop = useCallback(() => {
		clearInterval(interval.current);
		interval.current = null;
	}, []);

	useEffect(() => {
		if (autoStart) {
			start();
		}
	}, []);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	return { start, stop, active: !!interval.current };
}
