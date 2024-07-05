import { connect } from "@/lib/ipc";

const ChannelName = "log";
const ChannelPattern = new RegExp(`^${ChannelName}`);
const Methods = [
	"log",
	"warn",
	"error",
];

if (typeof ServiceWorkerGlobalScope === "function") {
	const { receive } = connect(ChannelPattern);
	const methodEntries = Methods.map((name) => [
		name,
		(...args) => {
			if (DEBUG) {
				const channel = args.pop();

				console[name].apply(console, [`[${channel.name}]`, ...args]);
			}
		}
	]);

	receive(Object.fromEntries(methodEntries));

		// map a global log() function to console.log() in the background
	Methods.forEach((name) => {
		globalThis[name] = (...args) => DEBUG && console[name].apply(console, args);
	});
} else if (typeof globalThis[Methods[0]] !== "function") {
	const pageName = location.pathname.match(/\/([^/]+)\.(html|js)/)?.[1] || "unknown";
	const callerName = pageName === "popup"
		? (location.search ? pageName : "menu")
		: pageName;
	const { call } = connect(`${ChannelName}/${callerName}`);

	Methods.forEach((name) => {
		globalThis[name] = (...args) => DEBUG && call(name, ...args);
	});
}
