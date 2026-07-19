import React from "react";


export function Checkbox({
	id,
	label,
	value,
	disabled,
	tooltip,
	tooltipDisabled,
	className,
	onChange,
	children,
	...props})
{
	function handleChange(
		event)
	{
		onChange?.(event.target.checked, id);
	}


	const classes = ["control", disabled ? "disabled" : "", className].join(" ");

	return (
		<div className={classes} {...props}>
			<label
				title={
					disabled
						? tooltipDisabled
						: tooltip
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


export function RadioButton({
	name,
	label,
	value,
	checked,
	disabled,
	tooltip,
	tooltipDisabled,
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
					disabled
						? tooltipDisabled
						: tooltip
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


export function Group({
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


export function RadioGroup({
	id,
	label,
	value,
	onChange,
	children,
	...props})
{
	const radioButtons = children.map(function(child) {
		return React.cloneElement(child, {
			key: child.props.value,
			name: id,
			checked: child.props.value == value,
			onChange: handleChange
		});
	});


	function handleChange(
		event)
	{
		onChange?.(event.target.value, id);
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
