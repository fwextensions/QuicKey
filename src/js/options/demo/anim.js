import { getKeysFromShortcut } from "@/options/shortcut-utils";

const StepFunctions = {
	reset({ setPopupVisible, setRecentIndex, setNavigating, shortcut, key }) {
		key("reset", ...shortcut.keys);
		setPopupVisible(false);
		setNavigating(false);
		setRecentIndex(0);
	},
	start({ setPopupVisible, setRecentIndex, shortcut, key, recents }) {
		key("down", ...shortcut.modifiers);
		key("press", shortcut.baseKey);
		setPopupVisible(true);
		setRecentIndex((recentIndex) => (recentIndex + 1) % recents.length);
	},
	down({ setRecentIndex, shortcut, key, recents }) {
		key("press", shortcut.baseKey);
		setRecentIndex((recentIndex) => (recentIndex + 1) % recents.length);
	},
	end({ setPopupVisible, updateRecents, shortcut, key }) {
		key("up", ...shortcut.modifiers);
		setPopupVisible(false);
		updateRecents();
	},
	pressDown({ setPopupVisible, setRecentIndex, shortcut, key }) {
		key("down", ...shortcut.keys);
		setPopupVisible(true);
		setRecentIndex(1);
	},
	pressUp({ setPopupVisible, updateRecents, shortcut, key }) {
		key("up", ...shortcut.keys);
		setPopupVisible(false);
		updateRecents();
	},
	startPreviousTab({ setNavigating }) {
		setNavigating(true);
	},
	pressPreviousTab({ setRecentIndex, shortcut, key, recents }) {
		key("press", ...shortcut.keys);
		setRecentIndex((recentIndex) => (recentIndex + 1) % recents.length);
	},
	endPreviousTab({ setNavigating, updateRecents }) {
		setNavigating(false);
		updateRecents();
	},
	noop() {}
};
const DefaultFunctions = [
	"setRecentIndex",
	"setPopupVisible",
	"setNavigating",
	"updateRecents",
].reduce((result, method) => ({
	...result,
	[method]: StepFunctions.noop
}), {});

export function createAnimOptions(
	steps,
	options)
{
	const stepsWithFunctions = steps.map((item) => {
		const [functionName, delay] = [].concat(item);
		let func = StepFunctions[functionName];

		if (typeof functionName == "function") {
			func = functionName;
		}

		return [func, delay];
	});

	return {
		steps: stepsWithFunctions,
		...options
	};
}

export function createStepHandler(
	locals)
{
		// return a function that takes one of the StepFunctions defined above
		// and calls it with a hash of helper functions, most of which are
		// defined inside the component, as well as vars like shortcutRef and
		// recents
	return (step) => step({
			// supply some default noop functions, in case the caller doesn't
			// pass in local versions of those
		...DefaultFunctions,
		...locals,
			// convert the shortcut string into an info object
		shortcut: getKeysFromShortcut(locals.shortcut),
			// add a function that simplifies calling the <Shortcut> methods
		key(action, ...keys)
		{
			const method = `key${action[0].toUpperCase() + action.slice(1)}`;

			locals.shortcutRef.current[method](...keys);
		},
	});
}
