import React, {useContext} from "react";
import {Checkbox} from "./controls";
import {Section} from "./sections";
import NewSetting from "./new-setting";
import {HistoryIcon, WindowIcon, IncognitoIcon, InPrivateIcon} from "@/common/icons";
import {OptionsContext} from "./options-provider";
import * as k from "@/background/constants";


const {IncognitoNameUC, IncognitoNameLC, IncognitoPermission} = k;
const IncognitoAction = k.IsEdge ? "click the checkbox" : "toggle it on";
const IncognitoInstructions = k.IsFirefox
	? <span>right-click the QuicKey toolbar icon, select <i>Manage
		Extension</i>, and then click <i>Allow</i> next to the <i>Run in
		Private Windows</i> option</span>
	: <span>click the button below, then scroll down to
		the <i>{IncognitoPermission}</i> setting and {IncognitoAction}</span>;


export default function GeneralSection()
{
	const {
		openTab,
		settings,
		onChange
	} = useContext(OptionsContext);


	function handleChangeIncognitoClick()
	{
			// FF doesn't support opening the settings tab directly
		if (!k.IsFirefox) {
			openTab(`chrome://extensions/?id=${chrome.runtime.id}`, "incognito");
		}
	}


	return (
		<Section>
			<h2>Search results</h2>

			<Checkbox
				id={k.IncludeClosedTabs.Key}
				label={<span>Include recently closed tabs (marked with <HistoryIcon />)</span>}
				value={settings[k.IncludeClosedTabs.Key]}
				onChange={onChange}
			>
				<div className="subtitle">
					Selecting a closed tab will reopen it with its full history.
				</div>
			</Checkbox>
			<NewSetting addedVersion={10}>
				<Checkbox
					id={k.ShowBookmarkPaths.Key}
					label="Show the folder path to each bookmark in its title"
					value={settings[k.ShowBookmarkPaths.Key]}
					onChange={onChange}
				/>
			</NewSetting>
			<NewSetting addedVersion={10}>
				<Checkbox
					id={k.RestoreLastQuery.Key}
					label="Restore the last search query when QuicKey is reopened"
					value={settings[k.RestoreLastQuery.Key]}
					onChange={onChange}
				/>
			</NewSetting>
			<NewSetting addedVersion={9}>
				<Checkbox
					id={k.UsePinyin.Key}
					label="Use pinyin to match Chinese characters in titles and URLs"
					value={settings[k.UsePinyin.Key]}
					onChange={onChange}
				/>
			</NewSetting>


			<h2>Multiple browser windows</h2>

			<NewSetting addedVersion={11}>
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

			<NewSetting addedVersion={8}>
				<Checkbox
					id={k.ShowTabCount.Key}
					label="Show the number of open tabs in a badge on the QuicKey toolbar icon"
					value={settings[k.ShowTabCount.Key]}
					onChange={onChange}
				/>
			</NewSetting>


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
					onClick={handleChangeIncognitoClick}
				/>
				<button className="key"
					onClick={handleChangeIncognitoClick}
				>Change {IncognitoNameLC} setting</button>
			</div>}
		</Section>
	);
};
