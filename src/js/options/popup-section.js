define([
	"react",
	"jsx!./controls",
	"jsx!./sections",
	"background/constants"
], (
	React,
	{RadioButton, RadioGroup},
	{Section},
	{HidePopupBehavior: {Key, Offscreen, Behind, Tab, Minimize}}
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
				currentOption: this.props.settings[Key]
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
			this.setState({ currentOption: this.props.settings[Key] });
		},


		renderOption: function([
			id,
			label])
		{
			return (
				<RadioButton
					id={id}
					value={id}
					label={label}
					onMouseEnter={this.handleMouseEnter}
					onMouseLeave={this.handleMouseLeave}
				/>
			);
		},


		render: function()
		{
			const {id, settings, onChange} = this.props;
			const {currentOption} = this.state;

			return (
				<Section id={id}>
					<h2>Popup window</h2>

					<RadioGroup
						id={Key}
						value={settings[Key]}
						label={<span>When the alt-tab-style popup closes, hide it:</span>}
						onChange={onChange}
						style={{
							width: "20em",
							marginTop: "0",
							float: "left"
						}}
					>
						{
							[
								[Offscreen, "Off-screen"],
								[Behind, "Behind the active window"],
								[Tab, "In a tab"],
								[Minimize, "In a minimized window"],
							].map(this.renderOption)
						}
					</RadioGroup>

					<ProsCons option={currentOption}>
						<div id={Offscreen}>
							<div className="pro">Popup window shows/hides instantly</div>
							<div className="con">Popup window is left near the top of the alt-tab list</div>
							<div className="con">Doesn't work on macOS or when the UI isn't scaled to 100%</div>
						</div>
						<div id={Behind}>
							<div className="pro">Popup window shows/hides instantly</div>
							<div className="con">Popup window is left near the top of the alt-tab list</div>
							<div className="con">Popup window is visible if other windows are moved out of the way</div>
						</div>
						<div id={Tab}>
							<div className="pro">Popup window is removed from the alt-tab list</div>
							<div className="con">Popup window shows/hides a little more slowly</div>
							<div className="con">An extra tab is added to the last window</div>
						</div>
						<div id={Minimize}>
							<div className="pro">Popup window is at the bottom of the alt-tab list</div>
							<div className="con">Popup window shows/hides a little more slowly, due to OS animations</div>
						</div>
					</ProsCons>
				</Section>
			);
		}
	});


	return PopupSection;
});
