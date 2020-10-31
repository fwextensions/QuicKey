 define([
	"react"
], function(
	React
) {
	function Checkbox({
		id,
		label,
		value,
		disabled,
		className,
		onChange,
		children,
		...props})
	{
		function handleChange(
			event)
		{
			onChange(event.target.checked, id);
		}


		const classes = ["control", disabled ? "disabled" : "", className].join(" ");

		return (
			<div className={classes} {...props}>
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
		);
	}


	function RadioButton({
		name,
		label,
		value,
		checked,
		disabled,
		className,
		onChange,
		children,
		...props})
	{
		const classes = ["control", disabled ? "disabled" : "", className].join(" ");

		return (
			<li className={classes} {...props}>
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
		);
	}


	function Group({
		id,
		label,
		children,
		...props})
	{
		return (
			<div
				id={id}
				className="control-group"
				{...props}
			>
				<div className="label">{label}</div>
				{children}
			</div>
		);
	}


	function RadioGroup({
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


		return (
			<Group
				id={id}
				label={label}
				{...props}
			>
				<ul className="radio-list">
					{radioButtons}
				</ul>
			</Group>
		);
	}


	function noop() {}


	Checkbox.defaultProps = {
		onChange: noop
	};
	RadioGroup.defaultProps = {
		onChange: noop
	};


	return {
		Checkbox,
		RadioButton,
		Group,
		RadioGroup
	}
});
