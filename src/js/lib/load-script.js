const loaded = {};

export default function loadScript(
	url)
{
	if (loaded[url]) {
		return Promise.resolve(url);
	} else {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");

			script.onload = () => {
				loaded[url] = true;
				resolve(url);
			};
			script.onerror = () => reject(new Error(`Failed to load ${url}`));
			script.type = "text/javascript";
			script.charset = "utf-8";
			script.async = false;
				// only load scripts from within the extension
			script.src = chrome.runtime.getURL(url);

			document.head.appendChild(script);
		});
	}
}
