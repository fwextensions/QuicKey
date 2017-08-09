define([
		// we need react here even if we're not explicitly referencing it so
		// that the converted JSX can use it
	"react",
	"jsx!./results-list-item"
], function(
	React,
	Item
) {
	return function ResultsList(
		props)
	{
		var items = (props.items || []).map(function(item, i) {
				return <Item
					key={item.id}
					item={item}
					index={i}
					{...props}
				/>
			}),
				// hide the ul when the list is empty, so we don't force the
				// popup to be taller than the input when it's first opened
			style = {
				display: items.length ? "block" : "none"
			};

		return <ul className="results-list"
			style={style}
		>
			{items}
		</ul>
	};
});
