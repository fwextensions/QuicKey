import React from "react";


export function SectionLabel({
	section,
	label,
	selected,
	onClick})
{
	const className = ["section-label", selected ? "selected" : ""].join(" ");

	return (
		<li
			className={className}
			onClick={() => onClick(section)}
		>
			{label}
		</li>
	);
}


export function SectionList({
	selected,
	onClick,
	children})
{
	return (
		<ul className="section-list">
			{React.Children.toArray(children).map((child, i) =>
				React.cloneElement(child, {
					selected: child.props.section == selected,
					index: i,
					onClick
				}))}
		</ul>
	);
}


export function Section({
	children})
{
	return (
		<div className="section">
			{children}
		</div>
	);
}


export function Sections({
	children})
{
	return (
		<div className="sections">
			{children}
		</div>
	);
}
