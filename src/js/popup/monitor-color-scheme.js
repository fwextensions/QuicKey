import { connect } from "@/lib/ipc";

	// set this up after a slight delay so it doesn't slow down the menu opening
setTimeout(async () => {
	const { call } = connect("colorScheme");
	const matcher = matchMedia("(prefers-color-scheme: dark)");
	const getName = (matcher) => matcher.matches ? "dark" : "light";
	const setColorScheme = (matcher) => call("setColorScheme", getName(matcher));

	matcher.addEventListener("change", (event) => setColorScheme(event));
	await setColorScheme(matcher);
}, 500);
