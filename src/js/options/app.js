define([
	"react",
	"jsx!./keyboard-shortcuts",
	"jsx!./shortcut-picker",
	"jsx!./controls",
	"jsx!common/icons",
	"background/constants"
], function(
	React,
	Shortcuts,
	ShortcutPicker,
	{Checkbox, RadioButton, RadioGroup},
	{IncognitoIcon, InPrivateIcon, HistoryIcon, WindowIcon},
	k
) {
	const {IncognitoNameUC, IncognitoNameLC, IncognitoPermission} = k;
	const IncognitoAction = k.IsEdge ? "click the checkbox" : "toggle it on";
	const IncognitoInstructions = k.IsFirefox
		? <span>right-click the QuicKey toolbar icon, select <i>Manage
			Extension</i>, and then click <i>Allow</i> next to the <i>Run in
			Private Windows</i> option</span>
		: <span>click the button below, then scroll down to
			the <i>{IncognitoPermission}</i> setting and {IncognitoAction}</span>;
	const UpdateMessage = <div className="update-message"
		title="Now you can use pinyin to search for Chinese characters in web page titles and URLs. You can always reopen this page by clicking the gear icon in the QuicKey menu."
	>
		<h3>现在，您可以使用拼音在网页标题和URL中搜索中文字符。</h3>
		<h4>您始终可以通过单击QuicKey菜单中的齿轮图标来重新打开此页面。</h4>
	</div>;
	const BrowserClassName = k.IsFirefox
		? "firefox"
		: k.IsEdge
			? "edge"
			: "chrome";


	function NewSetting({
		addedVersion,
		lastSeenOptionsVersion,
		children})
	{
		return (
			<div className="new-setting">
				{lastSeenOptionsVersion < addedVersion &&
					<div className="new-indicator">NEW</div>
				}
				{children}
			</div>
		);
	}


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
				// FF doesn't support opening the settings tab directly
			if (!k.IsFirefox) {
				this.openExtensionsTab("?id=" + chrome.runtime.id);
				this.props.tracker.event("extension", "options-incognito");
			}
		},


		handleSupportClick: function()
		{
			chrome.tabs.create({ url: "https://fwextensions.github.io/QuicKey/support/" });
			this.props.tracker.event("extension", "options-support");
		},


		renderShortcutSetting: function(
			shortcut)
		{
			const {settings} = this.props;
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

			return <li className="shortcut-setting"
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
			const {
				settings,
				showPinyinUpdateMessage,
				lastSeenOptionsVersion,
				onChange,
				onResetShortcuts
			} = this.props;

			return <main className={BrowserClassName}>
				{
					showPinyinUpdateMessage && UpdateMessage
				}


				<h1 className="quickey">QuicKey options
					<div className="help-button"
						title="Learn more about QuicKey's features"
						onClick={this.handleHelpButtonClick}
					>?</div>
				</h1>


				<h2>Search results</h2>

				<Checkbox
					id={k.IncludeClosedTabs.Key}
					label={<span>Include recently closed tabs in the search results (marked with <HistoryIcon />)</span>}
					value={settings[k.IncludeClosedTabs.Key]}
					onChange={onChange}
				>
					<div className="subtitle">
						Selecting a closed tab will reopen it with its full history.
					</div>
				</Checkbox>
				<NewSetting
					addedVersion={10}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<Checkbox
						id={k.ShowBookmarkPaths.Key}
						label="Show the folder path to each bookmark in its title"
						value={settings[k.ShowBookmarkPaths.Key]}
						onChange={onChange}
					/>
				</NewSetting>
				<NewSetting
					addedVersion={10}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<Checkbox
						id={k.RestoreLastQuery.Key}
						label="Restore the last search query when the menu is reopened"
						value={settings[k.RestoreLastQuery.Key]}
						onChange={onChange}
					/>
				</NewSetting>
				<NewSetting
					addedVersion={9}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<Checkbox
						id={k.UsePinyin.Key}
						label="Use pinyin to match Chinese characters in titles and URLs"
						value={settings[k.UsePinyin.Key]}
						onChange={onChange}
					/>
				</NewSetting>


				<h2>Multiple browser windows</h2>

				<NewSetting
					addedVersion={11}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<Checkbox
						id={k.CurrentWindowLimitRecents.Key}
						label="Limit recent tabs to the current browser window"
						value={settings[k.CurrentWindowLimitRecents.Key]}
						onChange={(value, key) => {
								// uncheck the search option if we're unchecked
							if (!value && settings[k.CurrentWindowLimitSearch.Key]) {
								onChange(false, k.CurrentWindowLimitSearch.Key);
							}

							onChange(value, key);
						}}
					>
						<Checkbox
							id={k.CurrentWindowLimitSearch.Key}
							label="Also limit search results to the current browser window"
							value={settings[k.CurrentWindowLimitSearch.Key]}
							onChange={(value, key) => {
									// make sure the recents option is checked if
									// we get checked
								if (value && !settings[k.CurrentWindowLimitRecents.Key]) {
									onChange(true, k.CurrentWindowLimitRecents.Key);
								}

								onChange(value, key);
							}}
						/>
					</Checkbox>
				</NewSetting>
				<Checkbox
					id={k.MarkTabsInOtherWindows.Key}
					label={<span>Mark tabs in other browser windows with <WindowIcon /></span>}
					value={settings[k.MarkTabsInOtherWindows.Key]}
					disabled={settings[k.CurrentWindowLimitRecents.Key] && settings[k.CurrentWindowLimitSearch.Key]}
					tooltipDisabled="When recent tabs and search results are limited to the current window, no tabs from other windows will be visible"
					onChange={onChange}
				/>


				<h2>Toolbar icon</h2>

				<NewSetting
					addedVersion={8}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<Checkbox
						id={k.ShowTabCount.Key}
						label="Show the number of open tabs in a badge on the QuicKey icon"
						value={settings[k.ShowTabCount.Key]}
						onChange={onChange}
					/>
				</NewSetting>


				<h2>Search box keyboard shortcuts</h2>

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
						disabled={k.IsFirefox}
					/>
					<RadioButton
						label="Close the menu immediately"
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

				<NewSetting
					addedVersion={10}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
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
					{this.renderShortcutList(settings.chrome.shortcuts)}
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


				{!k.IsFirefox && <div>
					<h2>{IncognitoNameUC} windows</h2>

					<p>By default, QuicKey can't switch to tabs in {IncognitoNameLC} windows.
						To enable this functionality, {IncognitoInstructions}.  {IncognitoNameUC} tabs
						are marked with <IncognitoIcon />.
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
				</div>}


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
