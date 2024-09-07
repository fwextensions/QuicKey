const _console = console;

export default function stdout(
	id)
{
	if (!id || typeof id !== "string") {
		return;
	}

_console.error("======= loading stdout ======", id);

		// provide a noop handler for the response from the stdout extension
	const noop = () => {};
	const filename = location.pathname.split("/").pop();

	globalThis.console = Object.keys(console)
		.filter((key) => typeof console[key] === "function")
		.reduce((result, method) => ({
			...result,
			[method](...args) {
				const payload = { method, filename, args };

				chrome.runtime.sendMessage(id, payload)
						// suppress any runtime.lastError messages, such as when
						// the stdout extension is not installed
					.then(noop, noop)

					// log the message locally as well
				_console[method](...args);
			}
		}), {});
}
