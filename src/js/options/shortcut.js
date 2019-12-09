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
		return <div className="shortcut" style={props.style}>
			{props.keys.map(key => key && <Key code={key} />)}
		</div>
	};
});
