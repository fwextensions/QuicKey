import { Homepage, Version } from "@/background/constants";

export function utm(
	url,
	source)
{
	if (!url.startsWith(Homepage)) {
		return url;
	}

	const utmURL = new URL(url);

	utmURL.searchParams.set("utm_source", source);
	utmURL.searchParams.set("utm_medium", "ext");
	utmURL.searchParams.set("utm_id", Version);

	return utmURL.href;
}
