class PopupEvent extends CustomEvent{
	constructor(
		type,
		detail = {})
	{
		super(type, { detail });
	}
}

	// create this subclass just so the target property of the events is not a
	// generic EventTarget
class PopupEmitter extends EventTarget {}

const target = new PopupEmitter();

export const popupEmitter = {
	on(
		type,
		callback)
	{
		[].concat(type).forEach((currentType) => {
			target.addEventListener(currentType, callback);
		});
	},

	removeListener(
		type,
		callback)
	{
		[].concat(type).forEach((currentType) => {
			target.removeEventListener(currentType, callback);
		});
	},

	emit(
		type,
		detail)
	{
		return target.dispatchEvent(new PopupEvent(type, detail));
	}
};
