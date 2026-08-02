# Analytics event streamlining proposal

Based on the GA4 numbers for Jul 3 – Aug 1, 2026: **32.7M events / 15,081 active
users** (~2,165 events per user per month).

## Summary

About **92% of the event volume is service worker lifecycle noise**, not user
behavior. Roughly 30M of the 32.7M events come from two calls that fire together
every time the MV3 service worker wakes up. Cutting those, collapsing the
`update` triplet, and filtering benign exceptions takes total volume from **32.7M
to ~2.5M/month (a ~93% reduction)** without losing any question we can currently
answer.

That reduction is worth doing on its own merits for GA hygiene, and it happens to
bring PostHog's 1M free tier within reach at a ~40% user sample instead of ~3%.

## Where the volume actually comes from

| Event | Count | Real driver |
|---|---:|---|
| `page_view` | 15M | service worker startup |
| `background-loaded` | 15M | service worker startup |
| `toggle-shortcut` | 1.7M | genuine user action |
| `exception` | 555K | see below |
| `focus-mru` | 360K | genuine user action |
| `missing-recents` | 171K | one third of `updateFromFreshTabs()` |
| `new-tabs` | 171K | one third of `updateFromFreshTabs()` |
| `old-recents` | 171K | one third of `updateFromFreshTabs()` |
| `popup-loaded` | 83K | popup open |
| `previous` | 62K | genuine user action |

Bucketed: **~30M lifecycle (92%)**, **~2.2M real user behavior (7%)**,
**555K exceptions (1.7%)**.

The GA-generated narrative about "power users in Bengaluru averaging 2,012 events"
is an artifact of this. It is measuring how often each user's service worker
respawned — which tracks how much they browse in general, not how much they use
QuicKey. It should not be read as an engagement signal.

## 1. Stop firing on every service worker startup (saves ~30M)

Both calls live in the same `.then()` in the startup chain
(`background.js` / `startup.js`):

```js
tracker.pageview();
tracker.timing("loading", "background-loaded", performance.now());
```

### `page_view` — delete it

This was written when MV2 had a persistent background page that loaded once per
browser session, where a pageview was a reasonable session marker. Under MV3 it
fires on every wakeup and corresponds to nothing the user sees or does. Worse, it
actively corrupts GA4's session and engagement modeling, since GA treats
`page_view` as session activity — so every idle respawn registers as engagement.

### `background-loaded` — keep the metric, sample the sends

The load-time histogram is still worth having, but not at 15M samples/month.
Send it when it carries signal:

- **always** on install, update, and `chrome.runtime.onStartup` (rare,
  high-signal, and exactly the cold starts where load time is user-visible)
- **1% sampled** on routine wakeups, to keep a warm-start baseline

~150K samples/month is far more than enough for stable percentiles.

## 2. Answer the "what happened while the popup was open" question properly

The original reason for the extra pageviews was to see which events occurred
while the popup had focus. Pageviews are an indirect and very expensive proxy
for that.

Direct replacement: keep a boolean that flips on popup connect/disconnect (the
`ports` handlers in `background.js` already know exactly when this happens) and
stamp it onto outgoing events as a property.

- **PostHog:** a super property — `posthog.register({ popup_open: true })` on
  connect, `false` on disconnect. Every subsequent event carries it, and any
  insight can then be broken down or filtered by `popup_open`.
- **GA4:** the same value via `tracker.set("popup_open", …)`, registered as a
  custom dimension.

Cost: zero extra events. It also answers the question better than pageviews ever
did, since you get the flag on the events themselves rather than having to infer
adjacency from timestamps.

Additionally, replace the popup open/close pageview pair with a single
`popup_session` event carrying a `ms` duration property — one event instead of
two, and the duration becomes directly chartable instead of requiring GA to
difference two timestamps.

## 3. Collapse the `update` triplet into one event (saves ~340K)

`old-recents`, `new-tabs`, and `missing-recents` are three separate events
describing a single `updateFromFreshTabs()` call, split apart only because GA4
has no clean way to average a metric across events.

```js
tracker.event("update", "recents-updated", {
	old_recents: tabIDs.length,
	new_tabs: freshTabs.length,
	missing: missingCount,
		// precomputed so the ratio is chartable without a derived metric
	missing_pct: tabIDs.length
		? Math.round((missingCount / tabIDs.length) * 100)
		: 0
});
```

This is a genuine PostHog advantage worth noting: PostHog charts average, median,
p90, etc. of any numeric property directly, so the workaround that forced three
events in the first place isn't needed there. In GA4 the equivalent requires
registering each as a custom metric.

Bonus: `missing_pct` on a single event is exactly the signal for the
tab-history-loss bug — one insight, "p90 of `missing_pct` after browser
restart," rather than trying to correlate three separate event streams.

## 4. Exceptions: 555K/month needs investigating before anything else

555K exceptions across 15,081 users is ~37 per user per month. That is not a
long tail of rare crashes; something is firing routinely.

### First: make the messages visible (no code change)

`tracker.exception()` sends the message as a `description` **event parameter**,
but GA4 only surfaces parameters in reports once they're registered as a
**custom dimension**. That is very likely why 555K exceptions have gone
un-diagnosed — the data is being collected and discarded at the reporting layer.

**Action: register `description` as a custom dimension in GA4 admin.** It's free
and takes effect immediately (though not retroactively). Do this before writing
any code, so the cleanup is driven by what's actually failing.

One caveat: `description` contains full stack traces up to 2000 chars, which is
very high cardinality — GA will bucket most of it into `(other)`. So also send a
normalized low-cardinality `error_type` (first line / message only, no stack,
no URLs) alongside the full `description`.

### Likely cause

`error-handler.js` reports **every** `unhandledrejection` as an exception with
`fatal: true`. Under MV3 these are routine lifecycle artifacts rather than bugs:

- `Extension context invalidated`
- `The message port closed before a response was received`
- `Could not establish connection. Receiving end does not exist`
- `No tab with id: …` (already filtered in `addTab`, but only there)

These fire whenever the worker is torn down mid-promise, which — per section 1 —
is happening tens of times per user per day.

### Proposed changes

1. Maintain a list of known-benign lifecycle rejection patterns and drop them in
   `handleError()` before they reach the tracker.
2. Stop hardcoding `fatal: true`. A port-closed rejection is not fatal, and
   marking it so inflates GA's crash-free-user metric.
3. Rate-limit exception reporting per worker lifetime (e.g. max 5), so a single
   error loop can't dominate the dataset — or blow a PostHog event budget.

Expected: 555K → well under 50K, with the remainder being real bugs worth acting
on.

## Projected volume after all changes

| Bucket | Before | After |
|---|---:|---:|
| SW lifecycle (`page_view` + `background-loaded`) | 30M | ~150K |
| User actions | ~2.2M | ~2.2M |
| `update` triplet | 513K | 171K |
| Exceptions | 555K | <50K |
| **Total** | **32.7M** | **~2.5M** |

## Implications for PostHog

At ~2.5M/month, the 1M free tier covers a **~40% deterministic user sample**
(~6,000 users at full event fidelity) rather than the ~3% (~450 users) that
current volume would allow. That is a large enough panel for confident funnel,
retention, and path analysis.

Sampling should still be **deterministic per user** — hash the stored `clientID`
UUID and compare to a threshold — so each install is consistently in or out and
event sequences stay intact. Event-level sampling would shred the sequences that
make those analyses possible.

Regardless of sample rate, **set a $0 billing limit in the PostHog project
settings** so overage drops events instead of generating a bill.

## Suggested sequencing

1. Register `description` (and add `error_type`) as GA4 custom dimensions —
   free, immediate, and tells us what the 555K exceptions are.
2. Delete the startup `page_view`; sample `background-loaded`. (~92% of volume,
   smallest diff of anything here.)
3. Collapse the `update` triplet; add the `popup_open` property.
4. Filter benign lifecycle rejections once step 1 shows what they are.
5. Re-measure for a week, then pick the PostHog sample rate from real numbers.

Steps 1–4 are worth doing whether or not PostHog ever ships.
