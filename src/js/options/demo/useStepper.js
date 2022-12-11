import { useCallback, useEffect, useRef, useState } from "react";

export default function useStepper(
	callback,
	options = {})
{
	const {
		steps,
		from = 0,
		to = Array.isArray(steps) ? steps.length - 1 : 0,
		increment = 1,
		delay = 1000,
		autoStart = true
	} = options;
	const [index, setIndex] = useState(autoStart ? from : null);
	const callbackRef = useRef(callback);
	const timer = useRef();

	const start = useCallback(() => {
		setIndex(from);
	}, [from]);

	const stop = useCallback(() => {
		setIndex(null);
		clearTimeout(timer.current);
		timer.current = null;
	}, []);

	useEffect(() => {
		if (index !== null && index <= to) {
				// the steps array can contain bare values, or tuples of a value
				// and a per-step delay.  so if we have steps, make sure the
				// current step is wrapped in an array if it's bare.
			const [stepValue, stepDelay = delay] = steps ? [].concat(steps[index]) : [];
				// pass the current item from the steps array, if we have one
			const args = steps ? [stepValue, index] : [index];

			callbackRef.current(...args);

			if (index < to) {
				timer.current = setTimeout(() => setIndex(index + increment), stepDelay);
			} else {
				stop();
			}
		} else {
			stop();
		}

		return () => clearTimeout(timer.current);
	}, [index]);

	useEffect(() => {
		const active = !!timer.current;

		stop();

		if (active || autoStart) {
			start();
		}
	}, [steps]);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	return { start, stop, active: !!timer.current };
}
