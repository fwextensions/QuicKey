import React from "react";
import {Checkbox, RadioButton, RadioGroup} from "./controls";
import {Section} from "./sections";
import NewSetting from "./new-setting";
import Shortcut from "./shortcut";
import NavigateRecents from "./demo/NavigateRecents";
import HidePopup from "./demo/HidePopup";
import * as k from "@/background/constants";


const SwitchWindowShortcut = k.IsMac ? "cmd-`" : "alt-tab";
const SwitchAppShortcut = k.IsMac ? "cmd-tab" : "alt-tab";


const ProsCons = ({
	option,
	children}) =>
(
	<div className="proscons">
		{children.filter(({props: {id}}) => id == option)}
	</div>
);


export default class PopupSection extends React.Component {
    state = {
        currentOption: this.props.settings[k.HidePopupBehavior.Key]
    };


	getShortcut(
		shortcutID)
	{
		return this.props.settings.chrome.shortcuts
			.find(({id}) => id == shortcutID)
			.shortcut;
	}


    handleMouseEnter = (
		event) =>
	{
		this.setState({ currentOption: event.currentTarget.id });
	};


    handleMouseLeave = () =>
	{
		this.setState({ currentOption: this.props.settings[k.HidePopupBehavior.Key] });
	};


	renderShortcut(
		shortcutID,
		direction)
	{
		const shortcutString = this.getShortcut(shortcutID);
		const shortcutName = `Switch to ${direction} tab shortcut`;

		return shortcutString
			? <Shortcut keys={shortcutString} title={shortcutName} />
			: <em>{shortcutName}</em>;
	}


	renderOption = ([
		id,
		label,
		disabled = false]) =>
	{
		const className = this.state.currentOption == id
			? "hide-popup current-popup-option"
			: "hide-popup";

		return (
			<RadioButton
				key={id}
				id={id}
				className={className}
				value={id}
				label={label}
				disabled={disabled}
				onMouseEnter={this.handleMouseEnter}
				onMouseLeave={this.handleMouseLeave}
			/>
		);
	};


    render()
	{
		const {id, settings, lastSeenOptionsVersion, onChange} = this.props;
		const {currentOption} = this.state;
		const hideOptions = [
			[k.HidePopupBehavior.Behind, "Behind the active window"],
			[k.HidePopupBehavior.Tab, "In a tab"],
			[k.HidePopupBehavior.Minimize, "In a minimized window"]
		].map(this.renderOption);
		const previousShortcutString = this.getShortcut(k.CommandIDs.PreviousTabCommand);
		const openPopupShortcutString = this.getShortcut(k.CommandIDs.OpenPopupCommand);
		const previousShortcut = this.renderShortcut(k.CommandIDs.PreviousTabCommand, "previous");
		const nextShortcut = this.renderShortcut(k.CommandIDs.NextTabCommand, "next");

		return (
			<Section id={id}>
				<h2>Show popup window while navigating recent tabs</h2>

				<NewSetting
					addedVersion={12}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<Checkbox
						id={k.NavigateRecentsWithPopup.Key}
						label={
							<div>
								<span>
									Show the recent tab list in a popup when
									using {previousShortcut} and {nextShortcut}
								</span>
							</div>
						}
						value={settings[k.NavigateRecentsWithPopup.Key]}
						onChange={onChange}
					/>
				</NewSetting>
				<NavigateRecents
					previousShortcut={previousShortcutString}
					navigateWithPopup={settings[k.NavigateRecentsWithPopup.Key]}
				/>


				<h2>Hide popup window</h2>

				<p>
					QuicKey offers different ways to hide the popup
					window, since the browser doesn't provide a simple
					solution for this.  Each approach has its own pros and cons, so
					you can select the one that feels best to you.
				</p>

				<NewSetting
					addedVersion={12}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<RadioGroup
						id={k.HidePopupBehavior.Key}
						value={settings[k.HidePopupBehavior.Key]}
						label={<span>When the {SwitchAppShortcut}-style popup closes, hide it:</span>}
						onChange={onChange}
						style={{
							width: "21em",
							margin: "0 0 6em 0"
						}}
					>
						{hideOptions}
					</RadioGroup>
					<ProsCons option={currentOption}>
						<div id={k.HidePopupBehavior.Behind}>
							<div className="pro">Popup shows/hides instantly</div>
							<div className="con">Popup is left near the top of the {SwitchWindowShortcut} list</div>
							<div className="con">Popup will be visible if other windows are moved out of the way</div>
						</div>
						<div id={k.HidePopupBehavior.Tab}>
							<div className="pro">Popup is removed from the {SwitchWindowShortcut} list</div>
							<div className="con">Popup shows/hides a little more slowly</div>
							<div className="con">An extra tab is added to the last window</div>
						</div>
						<div id={k.HidePopupBehavior.Minimize}>
							<div className="pro">Popup is at the bottom of the {SwitchWindowShortcut} list</div>
							<div className="con">Popup shows/hides the slowest, due to window animations</div>
						</div>
					</ProsCons>
				</NewSetting>
				<HidePopup
					shortcut={openPopupShortcutString}
					hidePopupBehavior={settings[k.HidePopupBehavior.Key]}
				/>
			</Section>
		);
	}
}
