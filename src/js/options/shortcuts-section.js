define([
	"react",
	"jsx!./controls",
	"jsx!./sections",
	"jsx!./new-setting",
	"jsx!./keyboard-shortcuts",
	"jsx!./shortcut-picker",
	"background/constants"
], (
	React,
	{RadioButton, RadioGroup},
	{Section},
	NewSetting,
	Shortcuts,
	ShortcutPicker,
	k
) => {
	const ShortcutSection = React.createClass({
		handleChangeShortcutsClick: function()
		{
			chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
			this.props.tracker.event("extension", "options-shortcuts");
		},


		handleCtrlTabClick: function()
		{
			chrome.tabs.create({ url: "https://fwextensions.github.io/QuicKey/ctrl-tab/" });
			this.props.tracker.event("extension", "options-ctrl-tab");
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
				id,
				settings,
				lastSeenOptionsVersion,
				onChange,
				onResetShortcuts
			} = this.props;

			return (
				<Section id={id}>
					<h2>Search box shortcuts</h2>

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
			);
		}
	});


	return ShortcutSection;
});
