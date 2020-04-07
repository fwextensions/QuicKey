define(() => {
	return function loadScript(
		url)
	{
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");

			script.onload = () => resolve(url);
			script.onerror = () => reject(new Error(`Failed to load ${url}`));
			script.type = "text/javascript";
			script.charset = "utf-8";
			script.async = false;
			script.src = url;

			document.head.appendChild(script);
		});
	}
});
