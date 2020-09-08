define([
	"react"
], function(
	React
) {
	function SectionLabel({
		id,
		label,
		selected,
		onClick})
	{
		const className = ["section-label", selected ? "selected" : ""].join(" ");
		const handleClick = () => onClick(id);

		return (
			<li id={id}
				className={className}
				onClick={handleClick}
			>{label}</li>
		);
	}


	function SectionList({
		selected,
		onClick,
		children})
	{
		return (
			<ul className="section-list">
				{React.Children.toArray(children).map((child, i) =>
					React.cloneElement(child, {
						selected: child.props.id == selected,
						index: i,
						onClick
					}))}
			</ul>
		);
	}


	function Section({
		id,
		children})
	{
		return (
			<div id={id}
				className="section">
				{children}
			</div>
		);
	}


	function Sections({
		selected,
		children})
	{
		return (
			<div className="sections">
				{children.filter(({props: {id}}) => id == selected)}
			</div>
		);
	}


	return {
		Sections,
		Section,
		SectionList,
		SectionLabel
	};
});
