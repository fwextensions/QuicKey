define([
	"react",
	"jsx!./app",
	"background/page-trackers",
	"background/quickey-storage",
	"background/settings",
	"background/constants"
], function(
	React,
	OptionsApp,
	trackers,
	storage,
	settings,
	{Platform, ShowTabCount, CurrentWindowLimitRecents, CurrentWindowLimitSearch, HidePopupBehavior}
	{Platform, ShowTabCount, HidePopupBehavior, NavigateRecentsWithPopup}
) {
	const PlusPattern = /\+/g;


	const OptionsAppContainer = React.createClass({
		tracker: trackers.options,
		platform: Platform,


		getInitialState: function()
		{
			return {
				settings: null,
				showPinyinUpdateMessage: false,
					// default this to Infinity so that no NEW badges are shown
					// until we get the real value from storage
				lastSeenOptionsVersion: Infinity
			};
		},


		componentDidMount: function()
		{
			const params = new URLSearchParams(location.search);
			const showPinyinUpdateMessage = params.has("pinyin");
			const paramLastSeenOptionsVersion = parseInt(params.get("lastSeenOptionsVersion"));

				// asynchronously get settings now and whenever the window is
				// focused, in case the Chrome shortcuts were changed in the
				// Extensions shortcuts page
			this.updateSettings();
			window.addEventListener("focus", this.updateSettings);

				// get the lastSeenOptionsVersion from storage, or from a URL
				// param for testing purposes.  a flag to show a message about
				// pinyin support may also be passed in when updating from 1.4.0.
			storage.set(({lastSeenOptionsVersion}) => {
				this.setState({
					showPinyinUpdateMessage,
					lastSeenOptionsVersion: Number.isInteger(paramLastSeenOptionsVersion)
						? paramLastSeenOptionsVersion
						: lastSeenOptionsVersion
				});

					// update the lastSeenOptionsVersion value in storage to the
					// current extension version, so that the red badge in the
					// popup is cleared and we won't show NEW badges the next
					// time the options page is opened
				return { lastSeenOptionsVersion: storage.version };
			});
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
				// add a disabled flag to the Chrome shortcuts so the options
				// page renders them as disabled
			settings.chrome.shortcuts.forEach(shortcut => shortcut.disabled = true);
			this.setState({ settings });
		},


		handleChange: function(
			value,
			key)
		{
			settings.set(key, value)
				.then(settings => {
					if (key == ShowTabCount.Key || key == HidePopupBehavior.Key
							|| key == NavigateRecentsWithPopup.Key) {
						chrome.runtime.sendMessage({
							message: "settingChanged",
							key,
							value
						});
					}

					return settings;
				})
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
			const {
				settings,
				showPinyinUpdateMessage,
				lastSeenOptionsVersion
			} = this.state;

				// for the first render, don't return any UI so that it doesn't
				// show default values that then change when the current
				// settings are returned asynchronously
			return <div className={this.platform}>
				{settings &&
					<OptionsApp
						settings={settings}
						showPinyinUpdateMessage={showPinyinUpdateMessage}
						lastSeenOptionsVersion={lastSeenOptionsVersion}
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
