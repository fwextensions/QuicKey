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
	{Checkbox, RadioButton, RadioGroup},
	k
) {
	const {IncognitoNameUC, IncognitoNameLC} = k;
	const IncognitoAction = k.IsEdge ? "click the checkbox" : "toggle it on";
	const ClosedIcon = () => <img
		src="img/history.svg"
		alt="Closed icon"
		style={{
			height: "1.2em",
			filter: "contrast(0.3)",
			verticalAlign: "bottom"
		}}
	/>;
	const WindowIcon = () => <img
		src="img/window.svg"
		alt="Other window icon"
		style={{
			height: "1.2em",
			paddingLeft: ".15em",
			filter: "contrast(0.3)",
			verticalAlign: "bottom"
		}}
	/>;
	const IncognitoIcon = () => <img
		src="img/incognito.svg"
		alt="Incognito icon"
		style={{
			height: "1.2em",
			verticalAlign: "bottom"
		}}
	/>;


	const OptionsApp = React.createClass({
		openExtensionsTab: function(
			page = "")
		{
			chrome.tabs.create({ url: "chrome://extensions/" + page });
		},


		handleHelpButtonClick: function()
		{
			chrome.tabs.create({ url: "https://fwextensions.github.io/QuicKey/" });
			this.props.tracker.event("extension", "options-help");
		},


		handleChangeShortcutsClick: function()
		{
			this.openExtensionsTab("shortcuts");
			this.props.tracker.event("extension", "options-shortcuts");
		},


		handleCtrlTabClick: function()
		{
			chrome.tabs.create({ url: "https://fwextensions.github.io/QuicKey/ctrl-tab/" });
			this.props.tracker.event("extension", "options-ctrl-tab");
		},


		handleChangeIncognitoClick: function()
		{
			this.openExtensionsTab("?id=" + chrome.runtime.id);
			this.props.tracker.event("extension", "options-incognito");
		},


		handleSupportClick: function()
		{
			chrome.tabs.create({ url: "https://fwextensions.github.io/QuicKey/support/" });
			this.props.tracker.event("extension", "options-support");
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
				const {modifiers, key} = this.props.chrome.popup;
				const modifier = modifiers[0];

				label = shortcut.createLabel(modifier);
				validator = shortcut.createValidator(modifier, key);
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
			const {settings, chrome: { shortcuts: chromeShortcuts }, onChange, onResetShortcuts} = this.props;

			return <main>
				<h1 className="quickey">QuicKey options
					<div className="help-button"
						title="Learn more about QuicKey's features"
						onClick={this.handleHelpButtonClick}
					>?</div>
				</h1>

				<h2>Search box</h2>
				<RadioGroup
					id={k.SpaceBehavior.Key}
					value={settings[k.SpaceBehavior.Key]}
					label={<span>Press <kbd>space</kbd> to:</span>}
					onChange={onChange}
				>
					<RadioButton
						label="Select the next item in the menu"
						value={k.SpaceBehavior.Select}
					/>
					<RadioButton
						label="Insert a space in the search query"
						value={k.SpaceBehavior.Space}
					/>
				</RadioGroup>

				<RadioGroup
					id={k.EscBehavior.Key}
					value={settings[k.EscBehavior.Key]}
					label={<span>Press <kbd>esc</kbd> to:</span>}
					onChange={onChange}
				>
					<RadioButton
						label="Clear the search query, or close the menu if the query is empty"
						value={k.EscBehavior.Clear}
					/>
					<RadioButton
						label="Close the menu immediately"
						value={k.EscBehavior.Close}
					/>
				</RadioGroup>

				<h2>Search results</h2>
				<Checkbox
					id={k.MarkTabsInOtherWindows.Key}
					label={<span>Mark tabs that are not in the current window with <WindowIcon /></span>}
					value={settings[k.MarkTabsInOtherWindows.Key]}
					onChange={onChange}
				/>
				<Checkbox
					id={k.IncludeClosedTabs.Key}
					label={<span>Include recently closed tabs in the search results (marked with <ClosedIcon />)</span>}
					value={settings[k.IncludeClosedTabs.Key]}
					onChange={onChange}
				>
					<div className="subtitle">
						Selecting a closed tab will reopen it with its full history.
					</div>
				</Checkbox>

				<h2>Customizable keyboard shortcuts</h2>
				{this.renderShortcutList(Shortcuts.customizable)}
				<button className="key"
					onClick={onResetShortcuts}
				>Reset shortcuts</button>

				<h2>Browser keyboard shortcuts</h2>
				<div className="chrome-shortcuts"
					title="Click to open the browser's keyboard shortcuts page"
					onClick={this.handleChangeShortcutsClick}
				>
					{this.renderShortcutList(chromeShortcuts)}
				</div>
				<button className="key"
					onClick={this.handleChangeShortcutsClick}
				>Change browser shortcuts</button>
				<button className="key"
					title="Learn how to make Chrome use ctrl-tab as a shortcut"
					onClick={this.handleCtrlTabClick}
				>Use ctrl-tab as a shortcut</button>

				<h2>Other keyboard shortcuts</h2>
				{this.renderShortcutList(Shortcuts.fixed)}

				<h2>{IncognitoNameUC} windows</h2>
				<p>By default, QuicKey can't switch to tabs in {IncognitoNameLC} windows.
					To enable this functionality, click the button below, then
					scroll down to the <i>Allow in {IncognitoNameLC}</i> setting
					and {IncognitoAction}.  {IncognitoNameUC} tabs are marked
					with <IncognitoIcon />.
				</p>
				<img className="incognito-screenshot"
					src={`/img/${IncognitoNameLC.toLocaleLowerCase()}-option.png`}
					alt={`${IncognitoNameUC} option`}
					title={`Change ${IncognitoNameLC} setting`}
					onClick={this.handleChangeIncognitoClick}
				/>
				<button className="key"
					onClick={this.handleChangeIncognitoClick}
				>Change {IncognitoNameLC} setting</button>

				<h2>Feedback and support</h2>
				<p>If you have a question, found a bug, or thought of a new
					feature you'd like to see, please visit the support page and
					leave a comment.
				</p>
				<button className="key"
					onClick={this.handleSupportClick}
				>Open support page</button>
			</main>
		}
	});


	return OptionsApp;
});
