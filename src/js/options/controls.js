 define([
	"react"
], function(
	React
) {
	const Controls = {
		Checkbox: function(
			props)
		{
			function onChange(
				event)
			{
				props.onChange(event.target.checked, props.id);
			}


			return <div className="control">
				<label
					title={
						props.disabled
							? props.tooltipDisabled
							: props.tooltip
					}
				>
					<input type="checkbox"
						checked={props.value}
						disabled={props.disabled}
						tabIndex="0"
						onChange={onChange}
					/>
					<div className="indicator" />
					<span>{props.label}</span>
					{props.children}
				</label>
			</div>
		},


		RadioButton: function(
			props)
		{
			return <li className="control">
				<label
					title={
						props.disabled
							? props.tooltipDisabled
							: props.tooltip
					}
				>
					<input type="radio"
						checked={props.checked}
						disabled={props.disabled}
						name={props.name}
						value={props.value}
						tabIndex="0"
						onChange={props.onChange}
					/>
					<div className="indicator" />
					<span>{props.label}</span>
					{props.children}
				</label>
			</li>
		},


		Group: function(
			props)
		{
			return <div className="control-group">
				<div className="label">{props.label}</div>
				{props.children}
			</div>
		},


		RadioGroup: function(
			props)
		{
			const id = props.id;
			const value = props.value;
			const radioButtons = props.children.map(function(child) {
				return React.cloneElement(child, {
					name: id,
					checked: child.props.value == value,
					onChange: onChange
				});
			});


			function onChange(
				event)
			{
				props.onChange(event.target.value, props.id);
			}


			return <Controls.Group
				label={props.label}
			>
				<ul>
					{radioButtons}
				</ul>
			</Controls.Group>
		}
	};


	function noop() {}


	Controls.Checkbox.defaultProps = {
		onChange: noop
	};
	Controls.RadioGroup.defaultProps = {
		onChange: noop
	};


	return Controls;
});
