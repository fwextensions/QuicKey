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
			signal.addEventListener("abort", () => this.resolve(signal.reason));
		}
	}

	abort(
		reason = new DOMException("Aborted", "AbortError"))
	{
		this.#controller.abort(reason);
	}
}
