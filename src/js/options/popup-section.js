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
			const background = this.state.currentOption == id
				? "#fafafa"
				: "transparent";

			return (
				<RadioButton
					id={id}
					value={id}
					label={label}
					style={{ background }}
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
					<h2>Hide popup window</h2>

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
							<div className="pro">Popup shows/hides instantly</div>
							<div className="con">Popup is left near the top of the alt-tab list</div>
							<div className="con">Doesn't work on macOS or when the UI isn't scaled to 100%</div>
						</div>
						<div id={Behind}>
							<div className="pro">Popup shows/hides instantly</div>
							<div className="con">Popup is left near the top of the alt-tab list</div>
							<div className="con">Popup is visible if other windows are moved out of the way</div>
						</div>
						<div id={Tab}>
							<div className="pro">Popup is removed from the alt-tab list</div>
							<div className="con">Popup shows/hides a little more slowly</div>
							<div className="con">An extra tab is added to the last window</div>
						</div>
						<div id={Minimize}>
							<div className="pro">Popup is at the bottom of the alt-tab list</div>
							<div className="con">Popup shows/hides a little more slowly, due to window animations</div>
						</div>
					</ProsCons>
				</Section>
			);
		}
	});


	return PopupSection;
});
