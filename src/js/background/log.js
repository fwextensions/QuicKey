[
	"log",
	"warn",
	"error",
].forEach((method) => {
	globalThis[method] = (...args) => DEBUG && console[method].apply(console, args);
});
