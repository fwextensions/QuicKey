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
		const qkOptions = "QuicKey options";
		const tooltip = newSettingsAvailable
			? `New ${qkOptions} available`
			: qkOptions;

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
