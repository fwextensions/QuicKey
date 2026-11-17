	// a faithful stand-in for the quickey-storage singleton, reproducing the
	// get/set task semantics of storage.js without any of the versioning or
	// migration machinery, so recent-tabs' state-machine logic can be tested in
	// isolation.  crucially it mirrors the real merge-and-save rule exactly:
	//   - get(task):  task receives a fresh clone of the data; nothing is saved
	//   - set(task):  task receives a fresh clone; if it returns a truthy value,
	//                 { ...data, ...result } becomes the new data; a falsy/void
	//                 return saves nothing
	// that last rule is what makes the `storage.set(() => { tabsByID })` no-op
	// (which returns undefined) observably fail to persist, so a regression test
	// can catch it.
	//
	// NOTE: because vi.mock factories are hoisted above imports, a test that
	// needs to seed/inspect the same instance the source imports should inline
	// an equivalent factory inside vi.hoisted().  this exported helper is for
	// non-hoisted use and to document the canonical semantics.

export function createStorageMock(
	initialData = {})
{
	const clone = (value) => structuredClone(value);
	let data = clone(initialData);

	async function doTask(
		task,
		saveResult)
	{
		const current = clone(data);
		const result = await task(current);

		if (saveResult && result) {
			data = { ...current, ...result };
		}

		return result;
	}

	return {
		get: (task = (d) => d) => doTask(task, false),
		set: (task) => doTask(task, true),
		reset: () => { data = {}; return Promise.resolve(); },
		get version() { return 1; },
			// test helpers
		_seed: (value) => { data = clone(value); },
		_dump: () => clone(data),
	};
}
