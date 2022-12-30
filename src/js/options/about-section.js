import React, { useContext } from "react";
import {OptionsContext} from "./options-provider";
import {Section} from "./sections";

export default function AboutSection()
{
	const {openTab} = useContext(OptionsContext);
	const {version} = chrome.runtime.getManifest();

    const handleSupportClick = () => openTab("https://fwextensions.github.io/QuicKey/support/", "support");

	return (
		<Section>
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
				leave a comment. Many of QuicKey's features, like searching
				with pinyin, indicating which tabs are in other windows, and
				so on, have been suggested by users like you.
			</p>
			<button className="key"
				onClick={handleSupportClick}
			>
				Open support page
			</button>
		</Section>
	);
}
