import { describe, it, expect } from "vitest";
import { getBrowserInfo } from "@/lib/browser-info";

	// what PostHog's $browser / $browser_version / $os come out as.  the point
	// is telling forks apart from Chrome, so most of these are forks that send
	// Chrome's UA string and only differ in userAgentData.brands.

const ChromeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const NotABrand = { brand: "Not_A Brand", version: "24" };


function nav(
	brands,
	{ userAgent = ChromeUA, platform = "Windows", ...rest } = {})
{
	return {
		userAgent,
		platform: "Win32",
		userAgentData: brands && { brands, platform },
		...rest
	};
}


describe("getBrowserInfo()", () => {
	it("reports Chrome from its brands", () => {
		expect(getBrowserInfo(nav([
			NotABrand,
			{ brand: "Chromium", version: "131" },
			{ brand: "Google Chrome", version: "131" },
		]))).toEqual({
			$browser: "Chrome",
			$browser_version: 131,
			$os: "Windows"
		});
	});

	it("reports Edge rather than the Chromium it's built on", () => {
		expect(getBrowserInfo(nav([
			{ brand: "Microsoft Edge", version: "130" },
			{ brand: "Chromium", version: "130" },
			NotABrand,
		])).$browser).toBe("Microsoft Edge");
	});

	it("reports Opera, Opera GX and Yandex by brand", () => {
		const browserFor = (brand) => getBrowserInfo(nav([
			{ brand: "Chromium", version: "130" },
			{ brand, version: "115" },
		]));

		expect(browserFor("Opera").$browser).toBe("Opera");
		expect(browserFor("Opera GX").$browser).toBe("Opera");
		expect(browserFor("YaBrowser")).toMatchObject({
			$browser: "Yandex",
			$browser_version: 115
		});
	});

		// Brave sends Chrome's brands on some versions, but always has
		// navigator.brave
	it("reports Brave from navigator.brave even when its brands say Chrome", () => {
		expect(getBrowserInfo(nav([
			{ brand: "Chromium", version: "131" },
			{ brand: "Google Chrome", version: "131" },
		], { brave: { isBrave: () => Promise.resolve(true) } }))).toMatchObject({
			$browser: "Brave",
			$browser_version: 131
		});
	});

		// Vivaldi lists no brand of its own, but it doesn't claim to be Google
		// Chrome either, which is what separates it
	it("reports a fork that only lists Chromium as Chromium", () => {
		expect(getBrowserInfo(nav([
			{ brand: "Chromium", version: "130" },
			NotABrand,
		])).$browser).toBe("Chromium");
	});

	it("falls back to the UA string without userAgentData", () => {
		expect(getBrowserInfo(nav(null, {
			userAgent: ChromeUA.replace("Safari/537.36", "Safari/537.36 OPR/114.0.0.0")
		}))).toMatchObject({ $browser: "Opera", $browser_version: 114 });

		expect(getBrowserInfo(nav(null, {
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) " +
				"Gecko/20100101 Firefox/133.0"
		}))).toMatchObject({ $browser: "Firefox", $browser_version: 133 });
	});

	it("uses navigator.platform for the OS when userAgentData has none", () => {
		const info = (platform) => getBrowserInfo({ userAgent: ChromeUA, platform }).$os;

		expect(info("MacIntel")).toBe("Mac OS X");
		expect(info("Linux x86_64")).toBe("Linux");
		expect(info("Win32")).toBe("Windows");
	});

	it("reports the OS from userAgentData", () => {
		const info = (platform) => getBrowserInfo(nav([], { platform })).$os;

		expect(info("macOS")).toBe("Mac OS X");
		expect(info("Chrome OS")).toBe("Chrome OS");
		expect(info("Linux")).toBe("Linux");
	});

	it("doesn't throw without a navigator", () => {
		expect(getBrowserInfo(null)).toEqual({
			$browser: "Unknown",
			$browser_version: undefined,
			$os: undefined
		});
	});
});
