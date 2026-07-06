import { PromiseWithResolvers } from "@/lib/promise-with-resolvers";

export class AbortablePromise extends PromiseWithResolvers {
	#controller;

	constructor(
		controller = new AbortController())
	{
		super();

		this.#controller = controller;

		const signal = this.#controller.signal;

		if (signal.aborted) {
// TODO: this should really be a reject(), but we don't want downstream users to have to call .catch() or
//  deal with the unhandled promise rejection.  and trying to add a .catch() to this instance returns a
//  regular promise without resolve/reject methods, which the storage receive() handlers expect.
			this.resolve(signal.reason);
		} else {
			const onAbort = () => this.resolve(signal.reason);
			const {resolve, reject} = this;

				// wrap resolve/reject so the abort listener is removed as soon
				// as the promise settles.  otherwise, instances sharing a
				// long-lived controller, like an ipc Channel, would accumulate
				// a listener per call, each one retaining its promise until
				// the controller is aborted.
			this.resolve = (value) => {
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			};
			this.reject = (reason) => {
				signal.removeEventListener("abort", onAbort);
				reject(reason);
			};

			signal.addEventListener("abort", onAbort);
		}
	}

	abort(
		reason = new DOMException("Aborted", "AbortError"))
	{
		this.#controller.abort(reason);
	}
}
