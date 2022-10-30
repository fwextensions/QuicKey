import React from "react";
	export default ({
		addedVersion,
		lastSeenOptionsVersion,
		children}) =>
	(
		<div className="new-setting">
			{lastSeenOptionsVersion < addedVersion &&
				<div className="new-indicator">NEW</div>
			}
			{children}
		</div>
	);

