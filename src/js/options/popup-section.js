import React from "react";
import {Checkbox, RadioButton, RadioGroup} from "./controls";
import {Section} from "./sections";
import NewSetting from "./new-setting";
import Shortcut from "./shortcut";
import {createRecents, createTabs} from "./demo/utils";
import {OptionsContext} from "./options-provider";
import NavigateRecents from "./demo/NavigateRecents";
import HidePopup from "./demo/HidePopup";
import SetShortcutLink from "./demo/SetShortcutLink";
import * as k from "@/background/constants";


const SwitchWindowShortcut = k.IsMac ? "cmd-`" : "alt-tab";
const SwitchAppShortcut = k.IsMac ? "cmd-tab" : "alt-tab";
const DemoTabCount = 10;
const {
	OpenPopupCommand,
	PreviousTabCommand,
	NextTabCommand,
	FocusPopupCommand
} = k.CommandIDs;


const ProsCons = ({
	option,
	children}) =>
(
	<div className="proscons">
		{children.filter(({props: {id}}) => id == option)}
	</div>
);


const PopupShortcut = ({
	shortcut: { label, shortcut: shortcutString },
	onClick}) =>
(
	<div className="labeled-shortcut">
		<div>{label}</div>
		{shortcutString
			? <Shortcut
				keys={shortcutString}
				title="Open the browser's keyboard shortcuts page"
				onClick={onClick}
			/>
			: <SetShortcutLink />
		}
	</div>
);


export default class PopupSection extends React.Component {
	static contextType = OptionsContext;


    state = {
        currentOption: this.context.settings[k.HidePopupBehavior.Key],
		tabs: createTabs(DemoTabCount),
		recents: createRecents(DemoTabCount)
    };


	getShortcut(
		shortcutID)
	{
		return this.context.settings.chrome.shortcutsByID[shortcutID];
	}


    handleChangeShortcutsClick = () =>
	{
		this.context.openTab("chrome://extensions/shortcuts", "shortcuts");
	};


    handleMouseEnter = (
		event) =>
	{
		this.setState({ currentOption: event.currentTarget.id });
	};


    handleMouseLeave = () =>
	{
		this.setState({ currentOption: this.context.settings[k.HidePopupBehavior.Key] });
	};


	renderShortcut(
		shortcutID,
		direction)
	{
		const shortcutString = this.getShortcut(shortcutID).shortcut;

		return shortcutString
			? <Shortcut
				keys={shortcutString}
				title={`Switch to ${direction} tab shortcut`}
			/>
			: <span><em>Switch to {direction} tab</em> shortcut</span>;
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
		const {settings, onChange} = this.context;
		const {currentOption, tabs, recents} = this.state;
		const hideOptions = [
			[k.HidePopupBehavior.Behind, "Behind the active window"],
			[k.HidePopupBehavior.Tab, "In a tab"],
			[k.HidePopupBehavior.Minimize, "In a minimized window"]
		].map(this.renderOption);
		const openPopupShortcut = this.getShortcut(OpenPopupCommand);
		const focusPopupShortcut = this.getShortcut(FocusPopupCommand);
		const previousShortcut = this.getShortcut(PreviousTabCommand);
		const previousShortcutKbd = this.renderShortcut(PreviousTabCommand, "previous");
		const nextShortcutKbd = this.renderShortcut(NextTabCommand, "next");

		return (
			<Section>
				<h2>Show popup window</h2>

				<p>
					In addition to the toolbar menu, QuicKey can be shown as a
					popup window.  The popup appears nearly instantly, since the
					window is never unloaded.  And it lets you use a single
					shortcut key to show the window and then select a tab to focus,
					providing the closest experience to the {SwitchAppShortcut} menu.
				</p>

				<PopupShortcut
					shortcut={openPopupShortcut}
					onClick={this.handleChangeShortcutsClick}
				/>
				<PopupShortcut
					shortcut={focusPopupShortcut}
					onClick={this.handleChangeShortcutsClick}
				/>

				<HidePopup
					shortcut={openPopupShortcut}
					hidePopupBehavior={settings[k.HidePopupBehavior.Key]}
					autoStart={true}
					tabs={tabs}
					recents={recents}
				/>


				<h2>Hide popup window</h2>

				<p>
					QuicKey offers different ways to hide the popup
					window, since the browser doesn't provide a simple
					solution for this.  Each approach has its own pros and
					cons, so you can select the one that feels best to you.
				</p>

				<NewSetting addedVersion={12}>
					<RadioGroup
						id={k.HidePopupBehavior.Key}
						value={settings[k.HidePopupBehavior.Key]}
						label={<span style={{ whiteSpace: "nowrap" }}>When the {SwitchAppShortcut}-style popup closes, hide it:</span>}
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


				<h2>Show popup window while navigating recent tabs</h2>

				<p>
					This option lets you view each tab for as long as you want
					while navigating with the <em>Switch to next/previous
					tab</em> shortcuts.  Keep holding the modifier key until you
					find the desired tab, and then release it to hide the popup.
				</p>

				<NewSetting addedVersion={12}>
					<Checkbox
						id={k.NavigateRecentsWithPopup.Key}
						label={
							<div>
								<span>
									Show the recent tabs popup while
									using {previousShortcutKbd} and {nextShortcutKbd}
								</span>
							</div>
						}
						value={settings[k.NavigateRecentsWithPopup.Key]}
						onChange={onChange}
					/>
				</NewSetting>

				<NavigateRecents
					shortcut={previousShortcut}
					navigateWithPopup={settings[k.NavigateRecentsWithPopup.Key]}
					tabs={tabs}
					recents={recents}
				/>
			</Section>
		);
	}
}
