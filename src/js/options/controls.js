 define([
	"react"
], function(
	React
) {
	const Controls = {
		Checkbox: function({
			id,
			label,
			value,
			disabled,
			onChange,
			children})
		{
			function handleChange(
				event)
			{
				onChange(event.target.checked, id);
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
						checked={value}
						disabled={disabled}
						tabIndex="0"
						onChange={handleChange}
					/>
					<div className="indicator" />
					<span>{label}</span>
					{children}
				</label>
			</div>
		},


		RadioButton: function({
			name,
			label,
			value,
			checked,
			disabled,
			onChange,
			children})
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
						checked={checked}
						disabled={disabled}
						name={name}
						value={value}
						tabIndex="0"
						onChange={onChange}
					/>
					<div className="indicator" />
					<span>{label}</span>
					{children}
				</label>
			</li>
		},


		Group: function({
			label,
			children})
		{
			return <div className="control-group">
				<div className="label">{label}</div>
				{children}
			</div>
		},


		RadioGroup: function({
			id,
			label,
			value,
			onChange,
			children})
		{
			const radioButtons = children.map(function(child) {
				return React.cloneElement(child, {
					name: id,
					checked: child.props.value == value,
					onChange: handleChange
				});
			});


			function handleChange(
				event)
			{
				onChange(event.target.value, id);
			}


			return <Controls.Group
				label={label}
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
