const StepFunctions = {
	reset({ setPopupVisible, setNavigating, moveSelection, shortcut, key }) {
		key("reset", ...shortcut.keys);
		setPopupVisible(false);
		setNavigating(false);
		moveSelection(0, true);
	},
	start({ setPopupVisible, moveSelection, shortcut, key }) {
		key("down", ...shortcut.modifiers);
		key("press", shortcut.baseKey);
		setPopupVisible(true);
		moveSelection(1);
	},
	down({ moveSelection, shortcut, key }) {
		key("press", shortcut.baseKey);
		moveSelection(1);
	},
	end({ setPopupVisible, updateRecents, shortcut, key }) {
		key("up", ...shortcut.modifiers);
		setPopupVisible(false);
		updateRecents();
	},
	pressDown({ setPopupVisible, moveSelection, shortcut, key }) {
		key("down", ...shortcut.keys);
		setPopupVisible(true);
		moveSelection(1, true);
	},
	pressUp({ setPopupVisible, updateRecents, shortcut, key }) {
		key("up", ...shortcut.keys);
		setPopupVisible(false);
		updateRecents();
	},
	startPreviousTab({ setNavigating }) {
		setNavigating(true);
	},
	pressPreviousTab({  moveSelection, shortcut, key }) {
		key("press", ...shortcut.keys);
		moveSelection(1);
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
	"moveSelection",
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
			// if the step doesn't include a delay, it will be returned as
			// undefined, and useStepper() will default to the delay specified
			// in the options object for this step
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
		moveSelection(
			value,
			absolute)
		{
			const { recents, setRecentIndex } = locals;

			if (absolute) {
				setRecentIndex(value);
			} else {
				setRecentIndex((recentIndex) => (recentIndex + value) % recents.length);
			}
		},
		updateRecents()
		{
			const { setRecentIndex, setRecents, setActiveTab } = locals;

				// we have to call the setters to get the current recentIndex
				// and recents, which is a little clunky, but oh well
			setRecentIndex((recentIndex) => {
				setRecents((recents) => {
						// move the current tab to the front of the recents stack
					recents.unshift(...recents.splice(recentIndex, 1));
					setActiveTab(recents[0]);

					return recents;
				});

				return 0;
			});
		},
			// add a function that simplifies calling the <Shortcut> methods
		key(
			action,
			...keys)
		{
			const method = `key${action[0].toUpperCase() + action.slice(1)}`;

			locals.shortcutRef.current[method](...keys);
		},
	});
}
