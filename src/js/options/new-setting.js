define([
	"react"
], function(
	React
) {
	return ({
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
});
