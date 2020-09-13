define([
	"react",
	"jsx!./keyboard-shortcuts",
	"jsx!./shortcut-picker",
	"jsx!./controls",
	"jsx!./sections",
	"jsx!common/icons",
	"background/constants"
], function(
	React,
	Shortcuts,
	ShortcutPicker,
	{Checkbox, RadioButton, RadioGroup},
	{Sections, Section, SectionList, SectionLabel},
	{IncognitoIcon, InPrivateIcon, HistoryIcon, WindowIcon},
	k
) {
	const {IncognitoNameUC, IncognitoNameLC} = k;
	const IncognitoAction = k.IsEdge ? "click the checkbox" : "toggle it on";
	const IncognitoIndicator = k.IsEdge ? <InPrivateIcon /> : <IncognitoIcon />;
	const UpdateMessage = <div className="update-message"
		title="Now you can use pinyin to search for Chinese characters in web page titles and URLs. You can always reopen this page by clicking the gear icon in the QuicKey menu."
	>
		<h3>现在，您可以使用拼音在网页标题和URL中搜索中文字符。</h3>
		<h4>您始终可以通过单击QuicKey菜单中的齿轮图标来重新打开此页面。</h4>
	</div>;


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
		getInitialState: function()
		{
			return {
				selectedSection: new URLSearchParams(location.search).get("section") || "search"
			};
		},


		openExtensionsTab: function(
			page = "")
		{
			chrome.tabs.create({ url: "chrome://extensions/" + page });
		},


		handleSectionClick: function(
			section)
		{
			this.setState({ selectedSection: section });
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
			const {selectedSection} = this.state;
			const {
				settings,
				showPinyinUpdateMessage,
				lastSeenOptionsVersion,
				onChange,
				onResetShortcuts
			} = this.props;

			return <main className={k.IsEdge ? "edge" : "chrome"}>
				{
					showPinyinUpdateMessage && UpdateMessage
					new URLSearchParams(location.search).has("pinyin") &&
						UpdateMessage
				}


				<h1 className="quickey">QuicKey options
					<div className="help-button"
						title="Learn more about QuicKey's features"
						onClick={this.handleHelpButtonClick}
					>?</div>
				</h1>

				<SectionList
					selected={selectedSection}
					onClick={this.handleSectionClick}
				>
					<SectionLabel id="search" label="Search" />
					<SectionLabel id="popup" label="Popup window" />
					<SectionLabel id="shortcuts" label="Keyboard shortcuts" />
					<SectionLabel id="incognito" label="Incognito windows" />
					<SectionLabel id="about" label="About" />
				</SectionList>

				<Sections selected={selectedSection}>
					<Section id="search">
						<h2>Search</h2>
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
						<Checkbox
							id={k.MarkTabsInOtherWindows.Key}
							label={<span>Mark tabs that are not in the current window with <WindowIcon /></span>}
							value={settings[k.MarkTabsInOtherWindows.Key]}
							onChange={onChange}
						/>
						<NewSetting
							addedVersion={8}
							lastSeenOptionsVersion={lastSeenOptionsVersion}
						>
							<Checkbox
								id={k.ShowTabCount.Key}
								label="Show the number of open tabs on the QuicKey icon"
								value={settings[k.ShowTabCount.Key]}
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
					</Section>

					<Section id="popup">
						<h2>Popup window</h2>
{/*
				<NewSetting
					addedVersion={10}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
						<RadioGroup
							id={k.HidePopupBehavior.Key}
							value={settings[k.HidePopupBehavior.Key]}
							label={<span>When the alt-tab-style popup closes, hide it:</span>}
							onChange={onChange}
						>
							<RadioButton
								label="Off-screen"
								value={k.HidePopupBehavior.Offscreen}
							>
								<div className="pro">Popup window shows/hides instantly</div>
								<div className="con">Popup window is left near the top of the alt-tab list</div>
								<div className="con">Doesn't work on macOS or when the UI isn't scaled to 100%</div>
							</RadioButton>
							<RadioButton
								label="Behind the active window"
								value={k.HidePopupBehavior.Behind}
							>
								<div className="pro">Popup window shows/hides instantly</div>
								<div className="con">Popup window is left near the top of the alt-tab list</div>
								<div className="con">Popup window is visible if other windows are moved out of the way</div>
							</RadioButton>
							<RadioButton
								label="In a tab"
								value={k.HidePopupBehavior.Tab}
							>
								<div className="pro">Popup window is removed from the alt-tab list</div>
								<div className="con">Popup window shows/hides a little more slowly</div>
								<div className="con">An extra tab is added to the bottom window</div>
							</RadioButton>
							<RadioButton
								label="In a minimized window"
								value={k.HidePopupBehavior.Minimize}
							>
								<div className="pro">Popup window is at the bottom of the alt-tab list</div>
								<div className="con">Popup window shows/hides a little more slowly, due to animations</div>
							</RadioButton>
						</RadioGroup>
					{/*</NewSetting>*/}
					</Section>

					<Section id="shortcuts">
						<h2>Customizable shortcuts</h2>
						{this.renderShortcutList(Shortcuts.customizable)}
						<button className="key"
							onClick={onResetShortcuts}
						>Reset shortcuts</button>

						<h2>Browser shortcuts</h2>
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
							title={`Learn how to make ${k.IsEdge ? "Edge" : "Chrome"} use ctrl-tab as a shortcut`}
							onClick={this.handleCtrlTabClick}
						>Use ctrl-tab as a shortcut</button>

						<h2>Other shortcuts</h2>
						{this.renderShortcutList(Shortcuts.fixed)}
					</Section>

					<Section id="incognito">
						<h2>{IncognitoNameUC} windows</h2>
						<p>By default, QuicKey can't switch to tabs in {IncognitoNameLC} windows.
							To enable this functionality, click the button below, then
							scroll down to the <i>Allow in {IncognitoNameLC}</i> setting
							and {IncognitoAction}.  {IncognitoNameUC} tabs are marked
							with {IncognitoIndicator}.
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
					</Section>

					<Section id="about">
						<h2>Feedback and support</h2>
						<p>If you have a question, found a bug, or thought of a new
							feature you'd like to see, please visit the support page and
							leave a comment.
						</p>
						<button className="key"
							onClick={this.handleSupportClick}
						>Open support page</button>
					</Section>
				</Sections>
			</main>
		}
	});


	return OptionsApp;
});
