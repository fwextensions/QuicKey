import control from "@/shared/control";
import initTabEvents from "@/shared/tabEventHandlers";
import initCommandEvents from "@/shared/commandHandlers";

export default function initEventController(
	context)
{
	return control.claimWhenAvailable(() => {
		initTabEvents(context);
		initCommandEvents(context);
console.log("===== eventController", globalThis.location.pathname);
	});
}
