	// stands in for the stdout-ext package under test.  that package is a
	// file: dependency on a sibling checkout, so it only exists on a machine
	// that has it, and error-handler.js imports it unconditionally.
export default function stdout() {}
