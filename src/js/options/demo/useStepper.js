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
	const [count, setCount] = useState(from);
	const savedCallback = useRef(callback);
	const interval = useRef();

	const handleStep = useCallback(() => setCount((count) => {
		if (count > to) {
			clearInterval(interval.current);
		} else {
			savedCallback.current(count);
			return count + step;
		}
	}), []);

	useEffect(() => {
		clearInterval(interval.current);
		interval.current = setInterval(handleStep, delay);

		return () => clearInterval(interval.current);
	}, [from, to, delay]);
}
