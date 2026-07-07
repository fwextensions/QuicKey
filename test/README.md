# Tests

Unit tests for QuicKey's non-UI logic, run with [Vitest](https://vitest.dev/).

```sh
npm test              # runs the unit suite (test/unit) — should always be green
npm run test:regression  # runs the regression suite (test/regression)
npm run test:all      # runs everything
npm run test:watch    # watch mode
```

## Layout

- **`test/unit/`** — behavioral coverage that passes against the current
  branch. `npm test` runs only this suite, so it is the one to gate CI on.
- **`test/regression/`** — each file documents a specific bug by asserting the
  **fixed** behavior. These are expected to **fail** until the referenced PR
  lands, at which point they turn green. When a PR merges, run
  `npm run test:regression`; any test for that PR that now passes should be
  moved into `test/unit/` (drop the `.regression` suffix) so it becomes part of
  the permanent green suite.
- **`test/support/`** — the fakes: an in-memory `chrome.*`, a `navigator.locks`
  implementation with real queuing semantics, and a faithful `quickey-storage`
  get/set stand-in.
- **`test/setup.js`** — installs the fakes as globals and mocks the analytics
  trackers before any source module loads. Registered via `setupFiles` in
  `vitest.config.js`.

## Writing tests

- Source modules read `chrome`, `navigator`, `location`, and `DEBUG` as globals;
  `test/setup.js` provides all of them. `chrome.storage.local` has `_seed()`,
  `_dump()`, and `clear()` helpers, and each `chrome.*.onEvent` hub has
  `.dispatch(...)` and `.listenerCount()` helpers.
- To test a module that imports the `quickey-storage` singleton (e.g.
  `recent-tabs`), mock it with the hoisted get/set stand-in shown at the top of
  `test/unit/recent-tabs.test.js` — `vi.mock()` factories are hoisted above
  imports, so the mock must be built inside `vi.hoisted()`.
- Match the source style: tabs for indentation, comments indented one extra tab.
