import React from "react";
import {HashRouter} from "react-router-dom";
import OptionsApp from "./app";
import trackers from "@/background/page-trackers";
import storage from "@/background/quickey-storage";
import settings from "@/background/settings";
import {Platform, ShowTabCount, HidePopupBehavior, NavigateRecentsWithPopup} from "@/background/constants";
import {OptionsProvider} from "./options-provider";
import {withSearchParams} from "./with-search-params";


const PlusPattern = /\+/g;


class OptionsAppContainer extends React.Component {
	tracker = trackers.options;
	platform = Platform;

    state = {
        settings: null,
        showPinyinUpdateMessage: false,
            // default this to Infinity so that no NEW badges are shown
            // until we get the real value from storage
        lastSeenOptionsVersion: Infinity
    };


    componentDidMount()
	{
		const {params} = this.props;
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
	}


    componentWillUnmount()
	{
		window.removeEventListener("focus", this.updateSettings);
	}


    updateSettings = () =>
	{
		return settings.get()
			.then(this.setSettingsState)
			.catch(console.error);
	};


	setSettingsState = (
		settings) =>
	{
			// add a disabled flag to the Chrome shortcuts so the options
			// page renders them as disabled
		settings.chrome.shortcuts.forEach(shortcut => shortcut.disabled = true);
		this.setState({ settings });
	};


	openTab = (
		url,
		eventName) =>
	{
		chrome.tabs.create({ url });
		this.tracker.event("extension", `options-${eventName}`);
	}


    handleChange = (
		value,
		key) =>
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
	};


    handleResetShortcuts = () =>
	{
		settings.resetShortcuts()
			.then(this.setSettingsState);

		this.tracker.event("setting", "reset");
	};


    render()
	{
		const context = {
			...this.state,
			tracker: this.tracker,
			openTab: this.openTab,
			onChange: this.handleChange,
			onResetShortcuts: this.handleResetShortcuts,
		};

			// for the first render, don't return any UI so that it doesn't
			// show default values that then change when the current
			// settings are returned asynchronously
		return (
			<OptionsProvider value={context}>
				<div className={this.platform}>
					{this.state.settings &&
						<OptionsApp />
					}
				</div>
			</OptionsProvider>
		);
	}
}

	// wrap the container component with an HOC so it gets the hashed search
	// params, which are only available via hook in react-router v6
const WrappedOptionsAppContainer = withSearchParams(OptionsAppContainer);

export default () => (
	<HashRouter>
		<WrappedOptionsAppContainer />
	</HashRouter>
);
