import control from "@/shared/control";
import { addTabHandlers } from "@/shared/tabEventHandlers";
import { addCommandHandlers } from "@/shared/commandHandlers";

export default function initEventController(
	sendPopupMessage,
	ports)
{
	return control.claimWhenAvailable(() => {
		addTabHandlers(sendPopupMessage, ports);
		addCommandHandlers(sendPopupMessage, ports);
console.log("===== eventController", globalThis.location.pathname);
	});
}
