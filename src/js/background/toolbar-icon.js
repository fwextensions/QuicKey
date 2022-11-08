import cp from "cp";
import trackers from "@/background/page-trackers";
import {IsEdge, IsFirefox} from "@/background/constants";


const backgroundTracker = trackers.background;

const BadgeColors = {
	light: {
			// make the count background slightly darker in FF so the text is
			// rendered in white instead of black on dark grey
		normal: IsFirefox ? "#666" : "#777",
		inverted: "#3367d6"
	},
	dark: {
		normal: "#666",
		inverted: "#3367d6"
	}
};
const IconPaths = {
	light: {
		normal: {
			path: {
				"19": "img/icon-19.png",
				"38": "img/icon-38.png"
			}
		},
		inverted: {
			path: {
				"19": "img/icon-19-inverted.png",
				"38": "img/icon-38-inverted.png"
			}
		}
	}
};
IconPaths.dark = {
	normal: IconPaths.light.inverted,
	inverted: IconPaths.light.normal
};
const ExtensionName = chrome.runtime.getManifest().short_name;


let isNormalIcon = true;
let isTabCountVisible = false;
let tabCount = 0;
let inversionTimer;


function getIconsAndBadgeColor(
	inverted)
{
	const osMode = matchMedia("(prefers-color-scheme: dark)").matches ?
		"dark" : "light";
	const iconMode = inverted ? "inverted" : "normal";
	const paths = IconPaths[osMode][iconMode];
	const color = BadgeColors[osMode][iconMode];

	return { paths, color };
}


async function setNormalIcon()
{
	const {paths, color} = getIconsAndBadgeColor();

	isNormalIcon = true;

	try {
		await cp.browserAction.setBadgeBackgroundColor({ color });
		await cp.browserAction.setIcon(paths);
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


async function invertFor(
	ms = 750)
{
		// pass true to get the inverted colors
	const {paths, color} = getIconsAndBadgeColor(true);

	isNormalIcon = false;
	clearTimeout(inversionTimer);
	inversionTimer = setTimeout(setNormalIcon, ms);

	try {
		if (isTabCountVisible) {
			await cp.browserAction.setBadgeBackgroundColor({ color });
		} else {
			await cp.browserAction.setIcon(paths);
		}
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


async function showTabCount(
	value)
{
	if (isTabCountVisible !== value) {
		isTabCountVisible = value;
		tabCount = (await cp.tabs.query({})).length;

		await setNormalIcon();
		await updateTabCount();
	}
}


async function updateTabCount(
	delta = 0)
{
		// default to an empty string, which will hide the badge
	let text = "";
	let title = ExtensionName;

	tabCount += delta;

	if (isTabCountVisible) {
		text = String(tabCount);

			// Edge appends the badge count with a comma after the badge title,
			// which looks awkward: "829 open tabs, 829".  so don't customize
			// the title in Edge.  format the count with a comma if the user
			// has 1,000+ (!) tabs open.
		if (!IsEdge) {
			title = `${ExtensionName} - ${tabCount.toLocaleString()} open tab${tabCount == 1 ? "" : "s"}`;
		}
	}

	try {
		await cp.browserAction.setBadgeText({ text }),
		await cp.browserAction.setTitle({ title })
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


export default {
	invertFor,
	showTabCount,
	updateTabCount,
	get isNormal() {
		return isNormalIcon;
	}
};
