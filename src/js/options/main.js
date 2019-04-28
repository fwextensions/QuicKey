require([
	"react",
	"react-dom",
	"jsx!options/app-container"
], function(
	React,
	ReactDOM,
	OptionsAppContainer
) {
	ReactDOM.render(
		React.createElement(OptionsAppContainer),
		document.getElementById("root")
	);
});
