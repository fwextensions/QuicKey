import { createContext, useContext } from "react";

export const DemoContext = createContext();

export function useScaled()
{
	const { scale } = useContext(DemoContext);

	return (value) => `${value * scale}px`;
}
