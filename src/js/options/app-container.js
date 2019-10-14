define([
	"react",
	"jsx!./app",
	"background/page-trackers",
	"background/settings"
], function(
	React,
	OptionsApp,
	trackers,
	settings
) {
	const PlusPattern = /\+/g;


	const OptionsAppContainer = React.createClass({
		tracker: trackers.options,
		platform: "win",


		getInitialState: function()
		{
			this.platform = /Mac/i.test(navigator.platform) ? "mac" : "win";

			return {
				settings: null
			};
		},


		componentDidMount: function()
		{
			window.addEventListener("focus", this.updateSettings);
			this.updateSettings();
			this.tracker.pageview();
		},


		componentWillUnmount: function()
		{
			window.removeEventListener("focus", this.updateSettings);
		},


		updateSettings: function()
		{
			return settings.get()
				.then(this.setSettingsState)
				.catch(console.error);
 		},


		setSettingsState: function(
			settings)
		{
			this.setState({ settings });
		},


		handleChange: function(
			value,
			key)
		{
			settings.set(key, value)
				.then(this.setSettingsState);

				// convert the value to a string before trying to do the
				// replacement, since some values are booleans
			this.tracker.event("setting", key, String(value).replace(PlusPattern, "-"));
		},


		handleResetShortcuts: function()
		{
			settings.resetShortcuts()
				.then(this.setSettingsState);

			this.tracker.event("setting", "reset");
		},


		render: function()
		{
			const {settings} = this.state;

				// for the first render, don't return any UI so that it doesn't
				// show default values that then change when the current
				// settings are returned asynchronously
			return <div className={this.platform}>
				{
					settings &&
					<OptionsApp
						settings={settings}
						shortcuts={settings.shortcuts}
						chromeShortcuts={settings.chromeShortcuts}
						tracker={this.tracker}
						onChange={this.handleChange}
						onResetShortcuts={this.handleResetShortcuts}
					/>
				}
			</div>
		}
	});


	return OptionsAppContainer;
});
