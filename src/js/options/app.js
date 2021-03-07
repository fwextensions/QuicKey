define([
	"react",
	"jsx!./sections",
	"jsx!./general-section",
	"jsx!./popup-section",
	"jsx!./shortcuts-section",
	"background/constants"
], function(
	React,
	{Sections, Section, SectionList, SectionLabel},
	GeneralSection,
	PopupSection,
	ShortcutsSection,
	k
) {
	const UpdateMessage = <div className="update-message"
		title="Now you can use pinyin to search for Chinese characters in web page titles and URLs. You can always reopen this page by clicking the gear icon in the QuicKey menu."
	>
		<h3>现在，您可以使用拼音在网页标题和URL中搜索中文字符。</h3>
		<h4>您始终可以通过单击QuicKey菜单中的齿轮图标来重新打开此页面。</h4>
	</div>;


	const OptionsApp = React.createClass({
		getInitialState: function()
		{
			return {
				selectedSection: this.props.defaultSection
			};
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


		handleSupportClick: function()
		{
			chrome.tabs.create({ url: "https://fwextensions.github.io/QuicKey/support/" });
			this.props.tracker.event("extension", "options-support");
		},


		render: function()
		{
			const {selectedSection} = this.state;
			const {
				settings,
				showPinyinUpdateMessage,
				lastSeenOptionsVersion,
				tracker,
				onChange,
				onResetShortcuts
			} = this.props;
			const {version} = chrome.runtime.getManifest();

			return <main className={k.IsEdge ? "edge" : "chrome"}>
				{
					showPinyinUpdateMessage && UpdateMessage
				}

				<h1 className="quickey">QuicKey options
					<div className="help-button"
						title="Learn more about QuicKey's features"
						onClick={this.handleHelpButtonClick}
					>?</div>
				</h1>

				<div className="sections-container">
					<SectionList
						selected={selectedSection}
						onClick={this.handleSectionClick}
					>
						<SectionLabel id="general" label="General" />
						<SectionLabel id="popup" label="Popup window" />
						<SectionLabel id="shortcuts" label="Keyboard shortcuts" />
						<SectionLabel id="about" label="About" />
					</SectionList>

					<Sections selected={selectedSection}>
						<GeneralSection
							id="general"
							settings={settings}
							lastSeenOptionsVersion={lastSeenOptionsVersion}
							tracker={tracker}
							onChange={onChange}
						/>

						<PopupSection
							id="popup"
							settings={settings}
							lastSeenOptionsVersion={lastSeenOptionsVersion}
							onChange={onChange}
						/>

						<ShortcutsSection
							id="shortcuts"
							settings={settings}
							lastSeenOptionsVersion={lastSeenOptionsVersion}
							tracker={tracker}
							onChange={onChange}
							onResetShortcuts={onResetShortcuts}
						/>

						<Section id="about">
							<h2>About</h2>

							<p>QuicKey adds keyboard shortcuts to switch tabs with a
								Quicksilver-style search or a most recently used menu.
							</p>
							<p>
								<a href="https://chrome.google.com/webstore/detail/quickey-%E2%80%93-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg" target="_blank">Version {version}</a>
							</p>
							<p>
								<a href="https://fwextensions.github.io/QuicKey/" target="_blank">Help page</a>
							</p>
							<p>
								<a href="https://fwextensions.github.io/QuicKey/privacy/" target="_blank">Privacy policy</a>
							</p>
							<p>
								<a href="https://github.com/fwextensions/QuicKey" target="_blank">Source code</a>
							</p>
							<p>
								<a href="https://chrome.google.com/webstore/detail/quickey-%E2%80%93-the-quick-tab-s/ldlghkoiihaelfnggonhjnfiabmaficg/reviews" target="_blank">Add a review</a>
							</p>

							<h2>Feedback and support</h2>

							<p>If you have a question, found a bug, or thought of a new
								feature you'd like to see, please visit the support page and
								leave a comment.  Many of QuicKey's features, like searching
								with pinyin, indicating which tabs are in other windows, and
								so on, have been suggested by users like you.
							</p>
							<button className="key"
								onClick={this.handleSupportClick}
							>Open support page</button>
						</Section>
					</Sections>
				</div>
			</main>
		}
	});


	return OptionsApp;
});
