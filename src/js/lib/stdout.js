export default function stdout(
	id)
{
	if (!id || typeof id !== "string") {
		return;
	}

		// provide a noop handler for the response from the stdout extension
	const noop = () => {};
	const filename = location.pathname.split("/").pop();

	globalThis.console = Object.keys(console)
		.filter((key) => typeof console[key] === "function")
		.reduce((result, method) => ({
			...result,
			[method](...args) {
				const payload = { method, filename, args };

				chrome.runtime.sendMessage(id, payload, noop);
			}
		}), {});
}
