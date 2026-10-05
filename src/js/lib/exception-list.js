	// builds the $exception_list property that PostHog's error tracking groups
	// issues on, in the same shape posthog-js produces.  each entry has the
	// error's type and message, plus its parsed stack frames, which PostHog
	// uses to fingerprint and name the issue.  without frames, every error
	// would be fingerprinted on its full message text, so the same bug at a
	// slightly different stack would open a new issue.
	// https://posthog.com/docs/error-tracking/issues-and-exceptions

const MaxFrames = 50;
	// ignore absurdly long lines, which are unlikely to be stack frames
const MaxLineLength = 1024;
	// V8 frames look like "at fn (url:line:col)" when there's a function name,
	// or "at url:line:col" for top-level code.  the location in the first form
	// may lack a line and column, as in "at Array.map (<anonymous>)".
const FrameWithFunctionPattern = /^\s*at (?:async )?(.+?) \((.+?)(?::(\d+))?(?::(\d+))?\)\s*$/;
const FrameWithoutFunctionPattern = /^\s*at (?:async )?(.+?)(?::(\d+))?(?::(\d+))?\s*$/;
	// the first line of a stack, like "TypeError: Cannot read properties"
const ErrorLinePattern = /^\s*(\w*(?:Error|Exception)): ?(.*)$/;
const UnknownFunction = "?";


function getExtensionOrigin()
{
	const origin = globalThis.location?.origin;

	return origin?.startsWith("chrome-extension://")
		? origin
		: "";
}


function createFrame(
	func,
	location,
	lineno,
	colno,
	origin)
{
		// our own code is the only thing worth fingerprinting on.  strip the
		// extension origin, since the ID differs between the store, Edge and
		// unpacked builds, and the same bug should group across all of them.
	const inApp = Boolean(origin) && location.startsWith(origin + "/");
	const frame = {
		platform: "web:javascript",
		filename: inApp ? location.slice(origin.length + 1) : location,
		function: (!func || func === "<anonymous>") ? UnknownFunction : func,
		in_app: inApp
	};

	if (lineno) {
		frame.lineno = Number(lineno);
	}

	if (colno) {
		frame.colno = Number(colno);
	}

	return frame;
}


export function parseStackFrames(
	stack = "")
{
	const origin = getExtensionOrigin();
	const frames = [];

	for (const line of String(stack).split("\n")) {
		if (frames.length >= MaxFrames) {
			break;
		}

		if (line.length > MaxLineLength || !/^\s*at /.test(line)) {
			continue;
		}

		let match = FrameWithFunctionPattern.exec(line);

		if (match) {
			const [, func, location, lineno, colno] = match;

			frames.push(createFrame(func, location, lineno, colno, origin));
		} else if ((match = FrameWithoutFunctionPattern.exec(line))) {
			const [, location, lineno, colno] = match;

			frames.push(createFrame(UnknownFunction, location, lineno, colno, origin));
		}
	}

		// V8 lists the throwing frame first, but PostHog, like Sentry, expects
		// it last
	return frames.reverse();
}


function createException(
	type,
	value,
	frames,
	handled)
{
	const exception = {
		type: type || "Error",
		value: value || "",
		mechanism: {
			handled,
			synthetic: false
		}
	};

	if (frames.length) {
		exception.stacktrace = {
			type: "raw",
			frames
		};
	}

	return exception;
}


export function createExceptionList(
	error,
	{ handled = true } = {})
{
	if (error instanceof Error || (error && typeof error.stack == "string")) {
		return [createException(error.name, error.message,
			parseStackFrames(error.stack), handled)];
	}

	if (typeof error == "string") {
			// a stack that was turned into a string still starts with the
			// error's type and message, so pull those out if they're there
		const [firstLine, ...rest] = error.split("\n");
		const match = ErrorLinePattern.exec(firstLine);

		return match
			? [createException(match[1], match[2], parseStackFrames(rest.join("\n")), handled)]
			: [createException("Error", error, parseStackFrames(error), handled)];
	}

	if (error && typeof error == "object") {
			// an ErrorEvent without an error object still has the message and
			// where it was thrown
		const { message, filename, lineno, colno } = error;
		const frames = filename
			? [createFrame(UnknownFunction, filename, lineno, colno, getExtensionOrigin())]
			: [];

		return [createException("Error", String(message ?? ""), frames, handled)];
	}

	return [createException("Error", error === undefined ? "Generic error" : String(error),
		[], handled)];
}
