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
			children,
			...props})
		{
			function handleChange(
				event)
			{
				onChange(event.target.checked, id);
			}


			return <div className="control" {...props}>
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
			children,
			...props})
		{
			return <li className="control" {...props}>
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
			id,
			label,
			children,
			...props})
		{
			return <div
				id={id}
				className="control-group"
				{...props}
			>
				<div className="label">{label}</div>
				{children}
			</div>
		},


		RadioGroup: function({
			id,
			label,
			value,
			onChange,
			children,
			...props})
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
				id={id}
				label={label}
				 {...props}
			>
				<ul className="radio-list">
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
