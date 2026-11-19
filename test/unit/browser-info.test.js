import { describe, it, expect } from "vitest";
import { getBrowserInfo } from "@/lib/browser-info";

	// what PostHog's $browser / $browser_version / $os come out as, plus the
	// full build numbers.  the point is telling forks apart from Chrome, so
	// most of these are forks that send Chrome's UA string and only differ in
	// userAgentData.brands.

	// Chromium browsers freeze the UA string's version at <major>.0.0.0
const ChromeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const NotABrand = { brand: "Not_A Brand", version: "24" };


	// a navigator whose brands are given as [brand, fullVersion] pairs.  the
	// low-entropy brands get just the major version, the way Chrome reports
	// them, and getHighEntropyValues() returns the full ones.
function nav(
	brands,
	{ userAgent = ChromeUA, platform = "Windows", highEntropy = "ok", ...rest } = {})
{
	const userAgentData = brands && {
		brands: brands.map(([brand, version]) => ({ brand, version: version.split(".")[0] })),
		platform,
		async getHighEntropyValues(hints)
		{
			if (highEntropy === "rejects") {
				throw new Error("NotAllowedError");
			}

			return hints.includes("fullVersionList")
				? { fullVersionList: brands.map(([brand, version]) => ({ brand, version })) }
				: {};
		}
	};

	if (userAgentData && highEntropy === "missing") {
		delete userAgentData.getHighEntropyValues;
	}

	return {
		userAgent,
		platform: "Win32",
		userAgentData,
		...rest
	};
}


describe("getBrowserInfo()", () => {
	it("reports Chrome from its brands, with its full version", async () => {
		expect(await getBrowserInfo(nav([
			["Not_A Brand", "24.0.0.0"],
			["Chromium", "131.0.6778.86"],
			["Google Chrome", "131.0.6778.86"],
		]))).toEqual({
			$browser: "Chrome",
			$browser_version: 131,
			browser_full_version: "131.0.6778.86",
			chromium_version: "131.0.6778.86",
			$os: "Windows"
		});
	});

	it("reports Edge rather than the Chromium it's built on", async () => {
		expect((await getBrowserInfo(nav([
			["Microsoft Edge", "130.0.2849.80"],
			["Chromium", "130.0.6723.117"],
		]))).$browser).toBe("Microsoft Edge");
	});

		// a fork's own version doesn't say which Chromium it's on
	it("reports a fork's own version and its Chromium version separately", async () => {
		expect(await getBrowserInfo(nav([
			["Chromium", "130.0.6723.137"],
			["Opera", "115.0.5322.68"],
		]))).toMatchObject({
			$browser: "Opera",
			$browser_version: 115,
			browser_full_version: "115.0.5322.68",
			chromium_version: "130.0.6723.137"
		});
	});

	it("reports Opera GX and Yandex by brand", async () => {
		const browserFor = async (brand) => (await getBrowserInfo(nav([
			["Chromium", "130.0.6723.137"],
			[brand, "115.0.0.1"],
		]))).$browser;

		expect(await browserFor("Opera GX")).toBe("Opera");
		expect(await browserFor("YaBrowser")).toBe("Yandex");
	});

		// Brave sends Chrome's brands on some versions, but always has
		// navigator.brave
	it("reports Brave from navigator.brave even when its brands say Chrome", async () => {
		expect(await getBrowserInfo(nav([
			["Chromium", "131.0.6778.86"],
			["Google Chrome", "131.0.6778.86"],
		], { brave: { isBrave: () => Promise.resolve(true) } }))).toMatchObject({
			$browser: "Brave",
			$browser_version: 131,
			chromium_version: "131.0.6778.86"
		});
	});

		// Vivaldi lists no brand of its own, but it doesn't claim to be Google
		// Chrome either, which is what separates it
	it("reports a fork that only lists Chromium as Chromium", async () => {
		expect((await getBrowserInfo(nav([
			["Chromium", "130.0.6723.92"],
			["Not_A Brand", "24.0.0.0"],
		]))).$browser).toBe("Chromium");
	});

	it("still reports the major version when the full versions are refused", async () => {
		const brands = [["Google Chrome", "131.0.6778.86"], ["Chromium", "131.0.6778.86"]];

		for (const highEntropy of ["rejects", "missing"]) {
			expect(await getBrowserInfo(nav(brands, { highEntropy }))).toEqual({
				$browser: "Chrome",
				$browser_version: 131,
				browser_full_version: undefined,
				chromium_version: undefined,
				$os: "Windows"
			});
		}
	});

	it("falls back to the UA string without userAgentData", async () => {
		expect(await getBrowserInfo(nav(null, {
			userAgent: ChromeUA.replace("Safari/537.36", "Safari/537.36 OPR/114.0.5282.102")
		}))).toMatchObject({
			$browser: "Opera",
			$browser_version: 114,
			browser_full_version: "114.0.5282.102"
		});

		expect(await getBrowserInfo(nav(null, {
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) " +
				"Gecko/20100101 Firefox/133.0"
		}))).toMatchObject({
			$browser: "Firefox",
			$browser_version: 133,
			browser_full_version: "133.0"
		});
	});

		// Chrome/131.0.0.0 is a placeholder, not a real build number
	it("doesn't report a frozen UA version as the full version", async () => {
		expect(await getBrowserInfo(nav(null))).toMatchObject({
			$browser: "Chrome",
			$browser_version: 131,
			browser_full_version: undefined
		});
	});

	it("uses navigator.platform for the OS when userAgentData has none", async () => {
		const os = async (platform) => (await getBrowserInfo({ userAgent: ChromeUA, platform })).$os;

		expect(await os("MacIntel")).toBe("Mac OS X");
		expect(await os("Linux x86_64")).toBe("Linux");
		expect(await os("Win32")).toBe("Windows");
	});

	it("reports the OS from userAgentData", async () => {
		const os = async (platform) => (await getBrowserInfo(nav([], { platform }))).$os;

		expect(await os("macOS")).toBe("Mac OS X");
		expect(await os("Chrome OS")).toBe("Chrome OS");
		expect(await os("Linux")).toBe("Linux");
	});

	it("doesn't throw without a navigator", async () => {
		expect(await getBrowserInfo(null)).toEqual({
			$browser: "Unknown",
			$browser_version: undefined,
			browser_full_version: undefined,
			chromium_version: undefined,
			$os: undefined
		});
	});
});
