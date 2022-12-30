import React from "react";
import {useSearchParams} from "react-router-dom";

export function withSearchParams(
	WrappedComponent)
{
	return (props) => {
		const [params] = useSearchParams();

		return <WrappedComponent {...props} params={params} />
	};
}
