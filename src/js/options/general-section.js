define([
	"react",
	"jsx!./controls",
	"jsx!./sections",
	"jsx!./new-setting",
	"jsx!common/icons",
	"background/constants"
], (
	React,
	{Checkbox},
	{Section},
	NewSetting,
	{HistoryIcon, WindowIcon},
	k
) => {
	return function GeneralSection({
		id,
		settings,
		lastSeenOptionsVersion,
		onChange})
	{
		return (
			<Section id={id}>
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
				<Checkbox
					id={k.MarkTabsInOtherWindows.Key}
					label={<span>Mark tabs that are not in the current window with <WindowIcon /></span>}
					value={settings[k.MarkTabsInOtherWindows.Key]}
					onChange={onChange}
				/>
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


				<h2>Toolbar icon</h2>

				<NewSetting
					addedVersion={8}
					lastSeenOptionsVersion={lastSeenOptionsVersion}
				>
					<Checkbox
						id={k.ShowTabCount.Key}
						label="Show the number of open tabs in a badge on the QuicKey toolbar icon"
						value={settings[k.ShowTabCount.Key]}
						onChange={onChange}
					/>
				</NewSetting>
			</Section>
		);
	};
});
