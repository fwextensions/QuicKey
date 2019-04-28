define([
	"react",
	"jsx!./keyboard-shortcuts",
	"jsx!./shortcut-picker",
	"jsx!./controls",
	"background/constants"
], function(
	React,
	Shortcuts,
	ShortcutPicker,
	Controls,
	k
) {
	const ClosedIcon = <img
		src="img/history.svg"
		alt="closed icon"
		style={{
			height: "1.2em",
			filter: "contrast(0.3)",
			verticalAlign: "bottom"
		}}
	/>;
	const IncognitoIcon = <img
		src="img/incognito.svg"
		alt="closed icon"
		style={{
			height: "1.2em",
			verticalAlign: "bottom"
		}}
	/>;


	const OptionsApp = React.createClass({
		openExtensionsTab: function(
			page)
		{
			chrome.tabs.create({ url: "chrome://extensions/" + page });
		},


		getNavigateKeyInfo: function()
		{
			const {chromeShortcuts} = this.props;

			return [
				chromeShortcuts.popupModifiers[0],
					// don't allow space as a navigation key
				new RegExp("[ " + chromeShortcuts.popupKey + "]", "i")
			];
		},


		handleChangeShortcutsClick: function()
		{
			this.openExtensionsTab("shortcuts");
		},


		handleCtrlTabClick: function()
		{
			chrome.tabs.create({ url: "https://fwextensions.github.io/QuicKey/ctrl-tab/" });
		},


		handleChangeIncognitoClick: function()
		{
			this.openExtensionsTab("?id=" + chrome.runtime.id);
		},


		renderShortcutSetting: function(
			shortcut)
		{
			const shortcutSettings = this.props.shortcuts;
			let label = shortcut.label;
			let validator = shortcut.validate;

				// special-case the navigate button, which depends on the current
				// Chrome keyboard shortcut for showing the QuicKey popup
			if (shortcut.id == k.Shortcuts.MRUSelect) {
				const [labelInfo, validatorInfo] = this.getNavigateKeyInfo();

				label = shortcut.createLabel(labelInfo);
				validator = shortcut.createValidator(validatorInfo);
			}

			return <li className="shortcut-setting"
					title={shortcut.tooltip}
			>
				<div className="label">{label}</div>
				<ShortcutPicker id={shortcut.id}
					shortcut={shortcut.shortcut || shortcutSettings[shortcut.id]}
					disabled={shortcut.disabled}
					placeholder={shortcut.placeholder}
					validate={validator}
					onChange={this.props.onChange}
				/>
			</li>
		},


		renderShortcutList: function(
			shortcuts)
		{
			return <ul>
				{shortcuts.map(this.renderShortcutSetting, this)}
			</ul>
		},


		render: function()
		{
			const props = this.props;
			const {settings, onChange} = props;

			return <main>
				<h1>QuicKey Options</h1>

				<h2>Search box</h2>
				<Controls.RadioGroup
					id={k.SpaceBehavior.Key}
					value={settings[k.SpaceBehavior.Key]}
					label={<span>Press <kbd>space</kbd> to:</span>}
					onChange={onChange}
				>
					<Controls.RadioButton
						label="Select the next item in the menu"
						value={k.SpaceBehavior.Select}
					/>
					<Controls.RadioButton
						label="Insert a space in the search query"
						value={k.SpaceBehavior.Space}
					/>
				</Controls.RadioGroup>

				<Controls.RadioGroup
					id={k.EscBehavior.Key}
					value={settings[k.EscBehavior.Key]}
					label={<span>Press <kbd>esc</kbd> to:</span>}
					onChange={onChange}
				>
					<Controls.RadioButton
						label="Clear the search query, or close the menu if the query is empty"
						value={k.EscBehavior.Clear}
					/>
					<Controls.RadioButton
						label="Close the menu immediately"
						value={k.EscBehavior.Close}
					/>
				</Controls.RadioGroup>

				<h2>Search results</h2>
				<Controls.Checkbox
					id={k.IncludeClosedTabs.Key}
					label="Include recently closed tabs in the search results"
					value={settings[k.IncludeClosedTabs.Key]}
					onChange={onChange}
				/>
				<p>Selecting a closed tab (indicated by {ClosedIcon})
					will reopen it with its full history.
				</p>

				<h2>Customizable keyboard shortcuts</h2>
				{this.renderShortcutList(Shortcuts.customizable)}
				<button className="key"
					onClick={props.onResetShortcuts}
				>Reset shortcuts</button>

				<h2>Chrome keyboard shortcuts</h2>
				<div className="chrome-shortcuts"
					title="Click to open the Chrome keyboard shortcuts page"
					onClick={this.handleChangeShortcutsClick}
				>
					{this.renderShortcutList(props.chromeShortcuts)}
				</div>
				<button className="key"
					onClick={this.handleChangeShortcutsClick}
				>Change Chrome shortcuts</button>
				<button className="key"
					title="Learn how to make Chrome use ctrl-tab as a shortcut"
					onClick={this.handleCtrlTabClick}
				>Use ctrl-tab as a shortcut</button>

				<h2>Other keyboard shortcuts</h2>
				{this.renderShortcutList(Shortcuts.fixed)}

				<h2>Incognito windows</h2>
				<p>By default, QuicKey can't switch to tabs in incognito windows.
					To enable this functionality, click the button below, then
					scroll down to the <i>Allow in incogito</i> setting and
					toggle it on.  Incognito tabs are indicated with this
					icon: {IncognitoIcon}.
				</p>
				<button className="key"
					onClick={this.handleChangeIncognitoClick}
				>Change incognito setting</button>
			</main>
		}
	});


	return OptionsApp;
});
