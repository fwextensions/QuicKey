import React from "react";
import {Sections, SectionList, SectionLabel} from "./sections";
import GeneralSection from "./general-section";
import PopupSection from "./popup-section";
import ShortcutsSection from "./shortcuts-section";
import AboutSection from "./about-section";
import {OptionsContext} from "./options-provider";
import * as k from "@/background/constants";


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


export default class OptionsApp extends React.Component {
	static contextType = OptionsContext;


    state = {
        selectedSection: this.props.defaultSection
    };


    handleSectionClick = (
		section) =>
	{
		this.setState({ selectedSection: section });
	};


    handleHelpButtonClick = () =>
	{
		this.context.openTab("https://fwextensions.github.io/QuicKey/", "help");
	};


    handleSupportClick = () =>
	{
		this.context.openTab("https://fwextensions.github.io/QuicKey/support/", "support");
	};


    render()
	{
		const {selectedSection} = this.state;
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
						onChange={onChange}
						onResetShortcuts={onResetShortcuts}
					/>

					<AboutSection id="about" />
				</Sections>
			</div>
		</main>
	}
}
