import React, {useContext} from "react";
import {Route, Routes, useLocation, useNavigate} from "react-router-dom";
import {Sections, SectionList, SectionLabel} from "./sections";
import GeneralSection from "./general-section";
import PopupSection from "./popup-section";
import ShortcutsSection from "./shortcuts-section";
import AboutSection from "./about-section";
import Shortcut from "./shortcut";
import {OptionsContext} from "./options-provider";
import * as k from "@/background/constants";


const PinyinUpdateMessage = <div className="update-message pinyin"
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


function WelcomeV2Message({
	openSettings })
{
	const Settings = ({ children }) => (
		<span className="link"
			title="Open the browser's keyboard shortcuts page"
			onClick={openSettings}
		>
			{children}
		</span>
	);

	const switchAppShortcut = k.IsMac ? "cmd+tab" : "alt+tab";

	return (
		<div className="update-message">
			<h3>Welcome to QuicKey 2.0</h3>
			<h4>Now you can press
				a <Settings>single shortcut key</Settings> to navigate
				recent tabs in a popup window, just like
				the <Settings><Shortcut keys={switchAppShortcut} style={{ fontSize: ".8rem", verticalAlign: "bottom" }} /></Settings> menu.
			</h4>
			<h4>See below for more new options.</h4>
		</div>
	);
}


export default function OptionsApp() {
	const { openTab, showWelcomeV2Message, showPinyinUpdateMessage } = useContext(OptionsContext);
	const navigate = useNavigate();
	const location = useLocation();
	const selectedSection = location.pathname.slice(1) || "general";

    const handleSectionClick = (section) => navigate(`/${section}`);

    const handleHelpButtonClick = () => openTab("https://fwextensions.github.io/QuicKey/", "help");

	const handleShortcutsClick = () => openTab("chrome://extensions/shortcuts", "shortcuts");

	return (
		<main className={BrowserClassName}>
			{showWelcomeV2Message && <WelcomeV2Message openSettings={handleShortcutsClick} />}

			{showPinyinUpdateMessage && PinyinUpdateMessage}

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
					<SectionLabel section="general" label="General" />
					<SectionLabel section="popup" label="Popup window" />
					<SectionLabel section="shortcuts" label="Keyboard shortcuts" />
					<SectionLabel section="about" label="About" />
				</SectionList>

				<Sections selected={selectedSection}>
					<Routes>
						<Route
							index
							element={<GeneralSection />}
						/>
						<Route
							path="general"
							element={<GeneralSection />}
						/>
						<Route
							path="popup"
							element={<PopupSection />}
						/>
						<Route
							path="shortcuts"
							element={<ShortcutsSection />}
						/>
						<Route
							path="about"
							element={<AboutSection />}
						/>
					</Routes>
				</Sections>
			</div>
		</main>
	);
}
