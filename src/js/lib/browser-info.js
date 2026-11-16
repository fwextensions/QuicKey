	// work out which browser and OS we're running in, as the $browser,
	// $browser_version and $os properties PostHog's UI breaks events down by.
	// posthog-js would add these itself, but lib/posthog.js posts to the
	// capture API directly, so without this every event looks the same whether
	// it came from Chrome, Edge or a fork.
	//
	// userAgentData.brands is the better source where it exists, since forks
	// that send Chrome's exact UA string still name themselves there (Brave,
	// Opera, Yandex).  Vivaldi and other forks that list only "Chromium"
	// come out as "Chromium", which still separates them from Google Chrome.
	// Arc lists itself as Google Chrome, so it can't be told apart.

	// checked in order, so a specific brand wins over the generic ones every
	// fork also lists
const Brands = [
	["Brave", "Brave"],
	["Microsoft Edge", "Microsoft Edge"],
	["Opera GX", "Opera"],
	["Opera", "Opera"],
	["YaBrowser", "Yandex"],
	["Yandex", "Yandex"],
	["Google Chrome", "Chrome"],
	["Chromium", "Chromium"],
];
	// for browsers without userAgentData, like Firefox, or a fork that blanks
	// its brands.  same order of precedence: the forks' tokens come before the
	// Chrome/ that they all include too.
const UATokens = [
	[/Edg\/(\d+)/, "Microsoft Edge"],
	[/OPR\/(\d+)/, "Opera"],
	[/YaBrowser\/(\d+)/, "Yandex"],
	[/Firefox\/(\d+)/, "Firefox"],
	[/Chrome\/(\d+)/, "Chrome"],
];


function getOS(
	platform = "",
	userAgent = "")
{
	if (/^Windows|^Win/i.test(platform)) {
		return "Windows";
	} else if (/^mac/i.test(platform)) {
		return "Mac OS X";
	} else if (/Chrome OS|CrOS/i.test(platform) || /CrOS/.test(userAgent)) {
		return "Chrome OS";
	} else if (/Linux/i.test(platform)) {
		return "Linux";
	}

	return platform || undefined;
}


export function getBrowserInfo(
	nav = globalThis.navigator)
{
	const { userAgent = "", userAgentData, brave } = nav ?? {};
	const brands = userAgentData?.brands ?? [];
	let browser;
	let version;

	for (const [brandName, name] of Brands) {
		const match = brands.find(({ brand }) => brand === brandName);

		if (match) {
			browser = name;
			version = match.version;
			break;
		}
	}

	if (!browser) {
		for (const [pattern, name] of UATokens) {
			const match = userAgent.match(pattern);

			if (match) {
				browser = name;
				version = match[1];
				break;
			}
		}
	}

		// Brave only lists itself in brands on some versions, but it always
		// adds navigator.brave
	if (brave && browser !== "Brave") {
		browser = "Brave";
	}

	const majorVersion = parseInt(version, 10);

	return {
		$browser: browser ?? "Unknown",
		$browser_version: Number.isFinite(majorVersion) ? majorVersion : undefined,
		$os: getOS(userAgentData?.platform || nav?.platform, userAgent)
	};
}
