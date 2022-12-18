export function openTab(
	url,
	eventName,
	tracker)
{
	chrome.tabs.create({ url });
	tracker.event("extension", `options-${eventName}`);
}
