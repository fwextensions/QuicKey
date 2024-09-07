import React from "react";
import {RadioButton, RadioGroup} from "./controls";
import {Section} from "./sections";
import NewSetting from "./new-setting";
import Shortcuts from "./keyboard-shortcuts";
import ShortcutPicker from "./shortcut-picker";
import {OptionsContext} from "./options-provider";
import * as k from "@/background/constants";


export default class ShortcutSection extends React.Component {
	static contextType = OptionsContext;


	handleChangeShortcutsClick = () =>
	{
		this.context.openTab("chrome://extensions/shortcuts", "shortcuts");
	};


	handleCtrlTabClick = () =>
	{
		this.context.openTab("https://fwextensions.github.io/QuicKey/ctrl-tab/", "ctrl-tab");
	};


	renderShortcutSetting = (
		shortcut,
		i) =>
	{
		const {settings, onChange} = this.context;
		let label = shortcut.label;
		let validator = shortcut.validate;

			// special-case the navigate button, which depends on the current
			// Chrome keyboard shortcut for showing the QuicKey popup
		if (shortcut.id == k.Shortcuts.MRUSelect) {
			const {modifiers, key} = settings.chrome.popup;
			const modifier = modifiers[0];

			label = shortcut.createLabel(modifier);
			validator = shortcut.createValidator(modifier, key);
		}

			// default to an index-based key for fixed shortcuts
		return <li className="shortcut-setting"
			key={shortcut.id || `shortcut-${i}`}
			title={shortcut.tooltip}
		>
			<div className="label">{label}</div>
			<ShortcutPicker id={shortcut.id}
					// non-customizable shortcuts will come with a shortcut
					// sequence.  otherwise, look up the current shortcut
					// in settings.
				shortcut={shortcut.shortcut || settings.shortcuts[shortcut.id]}
				disabled={shortcut.disabled}
				placeholder={shortcut.placeholder}
				validate={validator}
				onChange={onChange}
			/>
		</li>
	};


	renderShortcutList = (
		shortcuts) =>
	{
		return <ul>
			{shortcuts.map(this.renderShortcutSetting, this)}
		</ul>
	};


	render()
	{
		const {
			settings,
			onChange,
			onResetShortcuts
		} = this.context;

		return (
			<Section>
				<h2>Search box shortcuts</h2>

				<NewSetting addedVersion={13}>
					<RadioGroup
						id={k.SpaceBehavior.Key}
						value={settings[k.SpaceBehavior.Key]}
						label={<span>Press <kbd>space</kbd> to:</span>}
						onChange={onChange}
					>
						<RadioButton
							label={<span>Select the next item (include <b>shift</b> to select the previous one)</span>}
							value={k.SpaceBehavior.Select}
						/>
						<RadioButton
							label="Insert a space between search tokens"
							value={k.SpaceBehavior.Space}
						/>
						<RadioButton
							label="Do all of the above"
							value={k.SpaceBehavior.Both}
						/>
					</RadioGroup>
				</NewSetting>

				<RadioGroup
					id={k.EscBehavior.Key}
					value={settings[k.EscBehavior.Key]}
					label={<span>Press <kbd>esc</kbd> to:</span>}
					onChange={onChange}
				>
					<RadioButton
						label="Clear the search query, or close QuicKey if the query is empty"
						value={k.EscBehavior.Clear}
						disabled={k.IsFirefox}
					/>
					<RadioButton
						label="Close QuicKey immediately"
						value={k.EscBehavior.Close}
						disabled={k.IsFirefox}
					>
						{k.IsFirefox &&
							<div className="subtitle">
								Firefox always closes the menu when <kbd>esc</kbd> is pressed.
							</div>
						}
					</RadioButton>
				</RadioGroup>

				<NewSetting addedVersion={10}>
					<RadioGroup
						id={k.HomeEndBehavior.Key}
						value={settings[k.HomeEndBehavior.Key]}
						label={<span>Press <kbd>home</kbd> or <kbd>end</kbd> to:</span>}
						onChange={onChange}
					>
						<RadioButton
							label="Jump to the top or bottom of the search results"
							value={k.HomeEndBehavior.ResultsList}
						/>
						<RadioButton
							label="Move the cursor to the beginning or end of the search box"
							value={k.HomeEndBehavior.SearchBox}
						/>
					</RadioGroup>
				</NewSetting>


				<h2>Customizable shortcuts</h2>

				<p>
					These shortcuts can be used only when the QuicKey menu or popup
					window is open and has focus.
				</p>

				{this.renderShortcutList(Shortcuts.customizable)}
				<button className="key"
					onClick={onResetShortcuts}
				>Reset shortcuts</button>


				<h2>Browser shortcuts</h2>

				<p>
					These shortcuts can be used on any tab.
				</p>

				<div className="chrome-shortcuts"
					title="Open the browser's keyboard shortcuts page"
					onClick={this.handleChangeShortcutsClick}
				>
					{this.renderShortcutList(settings.chrome.shortcuts)}
				</div>
				<button className="key"
					onClick={this.handleChangeShortcutsClick}
				>Change browser shortcuts</button>
				<button className="key"
					title={`Learn how to make ${k.IsEdge ? "Edge" : "Chrome"} use ctrl-tab as a shortcut`}
					onClick={this.handleCtrlTabClick}
				>Use ctrl-tab as a shortcut</button>


				<h2>Bookmark and history shortcuts</h2>

				<p>
					These shortcuts control where a bookmark or history item
					is opened.
				</p>

				{this.renderShortcutList(Shortcuts.fixed)}
			</Section>
		);
	}
}
