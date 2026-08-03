import trackers from "@/background/page-trackers";
import { IsEdge, IsFirefox } from "@/background/constants";
import storage from "@/background/quickey-storage";
import { debounce } from "@/background/debounce";
import { connect } from "@/lib/ipc";


const backgroundTracker = trackers.background;

const BadgeColors = {
	light: {
			// make the count background slightly darker in FF and Edge so the
			// text is rendered in white instead of black on dark grey
		normal: (IsFirefox || IsEdge)
			? "#666"
			: "#777",
		inverted: "#3367d6"
	},
	dark: {
		normal: "#666",
		inverted: "#3367d6"
	}
};
const IconSizes = [16, 19, 24, 32, 38].reduce((result, size) => {
		// with manifest V3, the icon paths are relative to the background JS
		// file, so start with a / to make them absolute to the install folder
	result.normal.path[size] = `/img/icon-${size}.png`;
	result.inverted.path[size] = `/img/icon-${size}-inverted.png`;

	return result;
}, {
	normal: { path: {} },
	inverted: { path: {} }
});
const IconPaths = {
	light: {
		...IconSizes
	},
	dark: {
		normal: IconSizes.inverted,
		inverted: IconSizes.normal
	}
};
const ExtensionName = chrome.runtime.getManifest().short_name;


	// how long to wait for the tab count to settle before rendering it.  long
	// enough to collapse a burst of tabs.onCreated/onRemoved events into one
	// write, short enough that a single tab closing still looks instant.
const BadgeWriteDelay = 50;

let isNormalIcon = true;
let isTabCountVisible = false;
let tabCount = 0;
	// whether the badge currently has anything in it, so that we can tell a
	// pointless write (the count is off and nothing is shown) from the one
	// write that's needed to clear the badge after the count is turned off
let isBadgeShown = false;
let inversionTimer;
let colorScheme = "light";


function getIconsAndBadgeColor(
	inverted)
{
	const iconMode = inverted ? "inverted" : "normal";
	const paths = IconPaths[colorScheme][iconMode];
	const color = BadgeColors[colorScheme][iconMode];

	return { paths, color };
}


async function setNormalIcon()
{
	const {paths, color} = getIconsAndBadgeColor();

		// in case we were called directly and not by the inversion timer, we
		// want to clear any existing timer
	clearTimeout(inversionTimer);
	isNormalIcon = true;

	try {
		await chrome.action.setBadgeBackgroundColor({ color });
		await chrome.action.setIcon(paths);
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


async function setColorScheme(
	name)
{
	colorScheme = name;
	await setNormalIcon();
}


async function invertFor(
	ms = 750)
{
		// pass true to get the inverted colors
	const {paths, color} = getIconsAndBadgeColor(true);

	clearTimeout(inversionTimer);
	inversionTimer = setTimeout(setNormalIcon, ms);
	isNormalIcon = false;

	try {
		if (isTabCountVisible) {
			await chrome.action.setBadgeBackgroundColor({ color });
		} else {
			await chrome.action.setIcon(paths);
		}
	} catch (error) {
		backgroundTracker.exception(error);
	}
}


	// render whatever tabCount is up to now.  this is debounced rather than
	// called directly from updateTabCount() because closing a window fires
	// tabs.onRemoved for every tab in it: rendering each intermediate number is
	// wasted work, and during a browser shutdown every one of those calls
	// throws "The browser is shutting down", which we'd then report once per
	// tab.  the debounced function deliberately takes no arguments and reads
	// tabCount when it fires, since this debounce keeps only the last call's
	// args and would otherwise drop all but one of the deltas.
const writeBadge = debounce(async () => {
		// nothing to render and nothing left over to clear
	if (!isTabCountVisible && !isBadgeShown) {
		return;
	}

		// default to an empty string, which will hide the badge
	let text = "";
	let title = ExtensionName;

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
		await chrome.action.setBadgeText({ text });
		await chrome.action.setTitle({ title });

			// only after both writes land, so a failure leaves us knowing the
			// badge still needs clearing
		isBadgeShown = isTabCountVisible;
	} catch (error) {
		backgroundTracker.exception(error);
	}
}, BadgeWriteDelay);


async function showTabCount(
	value)
{
	if (isTabCountVisible !== value) {
		isTabCountVisible = value;

		if (value) {
				// only pay for the query when we're going to show the result.
				// while the count is hidden, tabCount drifts with the tab
				// events, and this is where it gets resynced
			tabCount = (await chrome.tabs.query({})).length;
		}

		await setNormalIcon();

			// toggling the setting should take effect now rather than after the
			// debounce.  turning the count off relies on this for the single
			// write that clears the badge, since nothing else will call
			// updateTabCount() afterwards.
		await writeBadge.now();
	}
}


function updateTabCount(
	delta = 0)
{
		// keep the running total exact even though the render is coalesced
	tabCount += delta;

	writeBadge();
}


connect("colorScheme").receive({
	async setColorScheme(
		name)
	{
		if (name !== colorScheme) {
			await setColorScheme(name);
			await storage.set(() => ({ colorScheme: name }));
		}
	}
});


export default {
	setColorScheme,
	setNormalIcon,
	invertFor,
	showTabCount,
	updateTabCount,
	get isNormal() {
		return isNormalIcon;
	}
};
