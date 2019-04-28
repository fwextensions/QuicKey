define([
	"react",
	"jsx!./key"
], function(
	React,
	Key
) {
	return function Shortcut(
		props)
	{
		const keys = props.keys.map(function(key) {
			return key && <Key code={key} />
		});

		return <div className="shortcut" style={props.style}>
			{keys}
		</div>
	};
});
