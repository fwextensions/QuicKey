import React, {useContext} from "react";
import {Route, Routes, useLocation, useNavigate} from "react-router-dom";
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


export default function OptionsApp({
	settings,
	showPinyinUpdateMessage,
	lastSeenOptionsVersion,
	onChange,
	onResetShortcuts })
{
	const {openTab} = useContext(OptionsContext);
	const navigate = useNavigate();
	const location = useLocation();
	const selectedSection = location.pathname.slice(1) || "general";

    const handleSectionClick = (section) => navigate(`/${section}`);

    const handleHelpButtonClick = () => openTab("https://fwextensions.github.io/QuicKey/", "help");

	return (
		<main className={BrowserClassName}>
			{
				showPinyinUpdateMessage && UpdateMessage
			}

			<h1 className="quickey">QuicKey options
				<div className="help-button"
					title="Learn more about QuicKey's features"
					onClick={handleHelpButtonClick}
				>?</div>
			</h1>

			<div className="sections-container">
				<SectionList
					selected={selectedSection}
					onClick={handleSectionClick}
				>
					<SectionLabel id="general" label="General" />
					<SectionLabel id="popup" label="Popup window" />
					<SectionLabel id="shortcuts" label="Keyboard shortcuts" />
					<SectionLabel id="about" label="About" />
				</SectionList>

				<Sections selected={selectedSection}>
					<Routes>
						<Route
							index
							element={
								<GeneralSection
									id="general"
									settings={settings}
									lastSeenOptionsVersion={lastSeenOptionsVersion}
									onChange={onChange}
								/>
							}
						/>
						<Route
							path="general"
							element={
								<GeneralSection
									id="general"
									settings={settings}
									lastSeenOptionsVersion={lastSeenOptionsVersion}
									onChange={onChange}
								/>
							}
						/>
						<Route
							path="popup"
							element={
								<PopupSection
									id="popup"
									settings={settings}
									lastSeenOptionsVersion={lastSeenOptionsVersion}
									onChange={onChange}
								/>
							}
						/>
						<Route
							path="shortcuts"
							element={
								<ShortcutsSection
									id="shortcuts"
									settings={settings}
									lastSeenOptionsVersion={lastSeenOptionsVersion}
									onChange={onChange}
									onResetShortcuts={onResetShortcuts}
								/>
							}
						/>
						<Route
							path="about"
							element={
								<AboutSection id="about" />
							}
						/>
					</Routes>
				</Sections>
			</div>
		</main>
	);
}
