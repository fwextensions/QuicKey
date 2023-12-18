[
	"log",
	"warn",
	"error",
].forEach((method) => {
	window[method] = (...args) => DEBUG && console[method].apply(console, args);
});
