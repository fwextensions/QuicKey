define([
	"react",
	"jsx!common/icons",
], function(
	React,
	{OptionsIcon}
) {
	return function OptionsButton({
		newSettingsAvailable,
		onClick
	}) {
		const tooltip = newSettingsAvailable
			? "New options are available"
			: "Options";

		return (
			<div className="options-button"
				title={tooltip}
				onClick={onClick}
			>
				<OptionsIcon/>
				{newSettingsAvailable && <div className="badge" />}
			</div>
		);
	};
});
