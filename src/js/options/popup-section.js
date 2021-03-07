define([
	"react",
	"jsx!./controls",
	"jsx!./sections",
	"jsx!./new-setting",
	"jsx!./shortcut",
	"background/constants"
], (
	React,
	{Checkbox, RadioButton, RadioGroup},
	{Section},
	NewSetting,
	Shortcut,
	k
) => {
	const ProsCons = ({
		option,
		children}) =>
	(
		<div className="proscons">
			{children.filter(({props: {id}}) => id == option)}
		</div>
	);

	const PopupSection = React.createClass({
		getInitialState: function()
		{
			return {
				currentOption: this.props.settings[k.HidePopupBehavior.Key]
			};
		},


		handleMouseEnter: function(
			event)
		{
			this.setState({ currentOption: event.currentTarget.id });
		},


		handleMouseLeave: function(
			event)
		{
			this.setState({ currentOption: this.props.settings[k.HidePopupBehavior.Key] });
		},


		renderOption: function([
			id,
			label,
				// it would be better to use a default value here, but esprima
				// and r.js can't handle it
			disabled])
		{
			const className = this.state.currentOption == id
				? "hide-popup current-popup-option"
				: "hide-popup";

			return (
				<RadioButton
					id={id}
					className={className}
					value={id}
					label={label}
					disabled={disabled}
					onMouseEnter={this.handleMouseEnter}
					onMouseLeave={this.handleMouseLeave}
				/>
			);
		},


		render: function()
		{
			const {id, settings, lastSeenOptionsVersion, onChange} = this.props;
			const {currentOption} = this.state;
			const hideOptions = [
					// disable this option on macOS, since it doesn't work
				[k.HidePopupBehavior.Offscreen, "Off-screen", k.IsMac],
				[k.HidePopupBehavior.Behind, "Behind the active window"],
				[k.HidePopupBehavior.Tab, "In a tab"],
				[k.HidePopupBehavior.Minimize, "In a minimized window"]
			].map(this.renderOption);

			return (
				<Section id={id}>
					<h2>Show popup window while navigating recent tabs</h2>

					<NewSetting
						addedVersion={11}
						lastSeenOptionsVersion={lastSeenOptionsVersion}
					>
						<Checkbox
							id={k.NavigateRecentsWithPopup.Key}
							label={<span>Show the recent tab list in a popup when
								using <Shortcut keys={["alt", "A"]}/> and <Shortcut keys={["alt", "S"]}/></span>}
							value={settings[k.NavigateRecentsWithPopup.Key]}
							onChange={onChange}
						/>
					</NewSetting>


					<h2>Hide popup window</h2>

					<NewSetting
						addedVersion={11}
						lastSeenOptionsVersion={lastSeenOptionsVersion}
					>
						<RadioGroup
							id={k.HidePopupBehavior.Key}
							value={settings[k.HidePopupBehavior.Key]}
							label={<span>When the alt-tab-style popup closes, hide it:</span>}
							onChange={onChange}
							style={{
								width: "20em",
								margin: "0 0 5em 0"
							}}
						>
							{hideOptions}
						</RadioGroup>
					<ProsCons option={currentOption}>
						<div id={k.HidePopupBehavior.Offscreen}>
							<div className="pro">Popup shows/hides instantly</div>
							<div className="con">Popup is left near the top of the alt-tab list</div>
							<div className="con">Doesn't work on macOS or when the UI isn't scaled to 100%</div>
						</div>
						<div id={k.HidePopupBehavior.Behind}>
							<div className="pro">Popup shows/hides instantly</div>
							<div className="con">Popup is left near the top of the alt-tab list</div>
							<div className="con">Popup is visible if other windows are moved out of the way</div>
						</div>
						<div id={k.HidePopupBehavior.Tab}>
							<div className="pro">Popup is removed from the alt-tab list</div>
							<div className="con">Popup shows/hides a little more slowly</div>
							<div className="con">An extra tab is added to the last window</div>
						</div>
						<div id={k.HidePopupBehavior.Minimize}>
							<div className="pro">Popup is at the bottom of the alt-tab list</div>
							<div className="con">Popup shows/hides a little more slowly, due to window animations</div>
						</div>
					</ProsCons>
					</NewSetting>

				</Section>
			);
		}
	});


	return PopupSection;
});
