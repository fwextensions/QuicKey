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
- **`test/support/`** — the fakes: an in-memory `chrome.*` with a stateful
  tab/window model (mutating APIs fire the same events the real browser
  would), a `navigator.locks` implementation with real queuing semantics, a
  faithful `quickey-storage` get/set stand-in, and `context.js`, a harness
  for standing up multiple extension contexts (worker, popup) as independent
  module graphs sharing one chrome fake and one lock manager.
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
- To test worker/popup interactions, use `resetContexts()` +
  `createContext()` from `test/support/context.js`, following
  `test/unit/worker-popup-control.test.js`.  Each context is a fresh module
  graph with its own `location.pathname` and its own `control.isHeld()`
  state; `destroy()` simulates MV3 killing the context (detaches its chrome
  listeners and revokes its `__control__` lock).  Create contexts one at a
  time and flush between creations so listener ownership is inferred
  correctly.  Note that `vi.mock()` factories run once per file, so mocked
  modules (like `popup-window`) are shared across contexts — assert on call
  counts, not per-context instances, and `vi.clearAllMocks()` in
  `beforeEach`.
- `vi.mock("@/background/settings")` when importing the `commandHandlers`
  graph, so tests don't depend on the chrome-shortcut parsing it does.
- Match the source style: tabs for indentation, comments indented one extra tab.
