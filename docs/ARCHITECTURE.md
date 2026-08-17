# Architecture

A tour of the code and, more usefully, the reasoning behind it. If you are about
to add a feature, this is the file to read first.

## The shape

```
src/
  domain/    Pure logic. No React, no storage, no browser APIs.
  data/      Persistence behind one interface. No React.
  app/       React state: settings, theme, the store, the nursing timer.
  ui/        Components.
  styles/    Tokens, base, components, and the vendored fonts.
  test/      Shared test factories.
scripts/     Icon generation, font vendoring, browser smoke test, DOM snapshots.
```

Dependencies point strictly downwards: `ui` → `app` → `data` → `domain`. Nothing
in `domain` imports from anywhere else in the app, and nothing in `domain` or
`data` imports React.

That constraint is the single most important thing about this codebase, because of
where the project is going. v0.3 adds multi-caregiver sync, and v1.x may add a
native shell for widgets and Live Activities. Both need to reuse the logic and the
data model unchanged. Keeping React out of the lower two layers is what makes that
possible — and, in the meantime, it means the tricky parts are testable in
milliseconds without a DOM.

## Layers

### `domain/` — the rules

Plain functions and types. Units, time formatting, nap-vs-night classification,
wake windows, daily summaries, day selection.

Everything here is deterministic: no `Date.now()`, no reads of global state. Any
function that needs the current time takes `now` as a parameter. That is why the
test suite can assert on a running sleep timer without faking timers, and why
every summary is reproducible.

Notable decisions:

- **Timestamps are epoch milliseconds, always UTC.** Local time appears only at
  the edges, when rendering or parsing a form. Anything else breaks the moment a
  user travels or the clocks change.
- **Volumes are stored in millilitres, always.** `oz` is purely a display unit.
  Storing whatever unit the user happened to prefer at the time makes historical
  data unusable.
- **Sleep is attributed to a day by overlap, not by start time.** A 10pm–6am night
  contributes two hours to one day and six to the next, so daily totals add up and
  can never exceed 24 hours.
- **Nap vs night is decided by when the sleep started**, against the user's own
  configured night window. A sleep beginning at 8pm is night sleep even if it ends
  at 3am.

### `data/` — persistence

One interface, `Repository`, describes every read and write the app performs.
`IndexedDbRepository` is the only implementation today.

- **IndexedDB, hand-wrapped.** A small promise wrapper rather than a library. The
  surface needed is genuinely small, and for an app whose main promise is privacy,
  a short dependency list is a feature: someone can audit the storage layer in one
  sitting.
- **UUID primary keys, not autoincrement.** v0.3 merges event streams from several
  caregivers' devices; independently generated ids must not collide.
- **A `[babyId, startedAt]` compound index.** Every query the app makes is "this
  baby's events, in time order", so that one index carries the load. v0.1 reads
  the full history because a year of dense logging is a few thousand small records;
  the index is there for when windowing starts to pay off.
- **Migrations are append-only.** Each schema change adds an
  `if (oldVersion < n)` block and bumps `DB_VERSION`. Existing blocks are never
  edited, because a user's device may upgrade from any earlier version.
- **Imports are validated, not trusted.** `validate.ts` re-checks every field of
  every record from a file. Malformed entries are skipped and counted rather than
  coerced, so a bad import can never corrupt the store.
- **Writes reload from storage.** Rather than optimistic local patching, a write
  goes to IndexedDB and then the store re-reads. It costs a millisecond or two and
  guarantees what you see is what is actually saved.

### `app/` — application state

- `settings.ts` — user settings in `localStorage`, not IndexedDB, because the
  theme must be known **synchronously on first paint**. An async read would flash
  a white screen at 3am, which is exactly what night mode exists to prevent. Every
  field is validated on load so a corrupt value degrades to a default instead of
  breaking launch.
- `useBabyStore.ts` — the single source of truth: babies, events, and every action.
- `nursingTimer.ts` — the nursing stopwatch as **plain data with pure
  transitions**, persisted to `localStorage`. Feeds outlast a phone locking, and
  losing a running timer at 3am is unforgivable. The UI never accumulates time
  itself; it calls `elapsedMs(state, now)`.
- `theme.ts` — resolves `auto` into `day`, `dark` or `night`.
- `repositoryContext.ts` / `RepositoryProvider.tsx` — split so the context module
  exports no components, which keeps Fast Refresh working.

### `ui/` and `styles/` — components and the design system

Plain React with CSS custom properties. No component library, no CSS-in-JS.

**The design has its own contract: [DESIGN.md](DESIGN.md). Read it before changing
anything visual.** It names the direction, the type and colour rules, the one
signature move, and an explicit list of things this project must never do. Drift
from it is a defect, not a preference — and the same applies to the tokens: the
colour ramps in `styles/tokens.css` are generated output with WCAG contrast solved
by construction, so nudging a hex by eye silently voids the guarantee.

```
styles/fonts.css    @font-face for the two vendored, self-hosted faces
styles/tokens.css   colour (light/dark/night), type scale, space scale, motion
styles/base.css     reset and base elements
styles/app.css      components
styles/fonts/       the actual woff2 files, vendored by `npm run fonts`
```

Design constraints that drove the visible choices:

- **Three themes, not two.** `dark` is an ordinary evening theme; `night` is a
  separate, dimmer, red-shifted palette for the small hours, when the screen is
  inches from a sleeping baby. Every colour is a token, so `night` is a palette
  swap rather than a second stylesheet.
- **No boxed cards.** Hairline rules and white space are the structure. Wrapping
  a bordered thing in another bordered thing is how v0.1 earned a `nested-cards`
  finding from the AI-tell detector.
- **Flush-left, rag-right.** Nothing is centred; centring is the absence of a
  layout decision.
- **Tap targets: 56px minimum, 72px for primary actions.** These buttons get
  pressed one-handed, half asleep, often while holding a baby.
- **Sheets are bottom-anchored** so their controls sit in thumb reach.
- **16px minimum font size on inputs**, which stops iOS Safari zooming the
  viewport on focus.
- **Every numeral carries `.num`** — the display face plus tabular figures. A
  timer that changes width as it ticks is a real defect, and the smoke test now
  measures for it, because `tabular-nums` silently does nothing on a font with no
  `tnum` feature.
- **Copy lives in `describeEvent.ts`**, apart from the components, so the exact
  wording is unit-tested. It gets read hundreds of times a week.

## Testing

Three layers, each for what it is actually good at:

1. **Unit tests** (`*.test.ts`, 156 of them) cover all domain logic, the storage
   layer against `fake-indexeddb`, the nursing timer state machine, validation and
   formatting. These run in about two seconds.
2. **A browser smoke test** (`scripts/smoke.mjs`) drives the built app in
   Chromium through the whole core loop, then switches the network off and checks
   the app still loads and logs. That offline claim is the project's central
   promise, so it is verified on every CI run rather than asserted in a README.
3. **Screenshots** are produced by the same smoke run, which keeps the README
   honest about what the app currently looks like.

A fourth, external check is worth running after any visual change: the
deterministic AI-tell detector from
[ryanthedev/design-for-ai](https://github.com/ryanthedev/design-for-ai). Because
this is a React SPA, point it at rendered output rather than the build:

```bash
npm run build
node scripts/snapshot.mjs .design-audit          # inlines CSS into static HTML
node <path-to>/design-for-ai/scripts/detect.mjs .design-audit/*.html
```

The current design scores 0 findings across 7 screens and 16 rules.

Test timestamps are always built from local calendar parts via the `at()` factory,
so assertions about wall-clock behaviour hold in whatever timezone CI runs in.

## Adding a new event type

The event model is a discriminated union, so the compiler will walk you through it.
To add, say, a temperature reading:

1. Add the interface to `domain/types.ts` and to the `BabyEvent` union.
2. Add a case to `parseEvent` in `data/validate.ts`.
3. Add a case to `describeEvent` in `ui/describeEvent.ts`.
4. Add a case to `rowFor` in `data/csv.ts`.
5. Add an action to `useBabyStore.ts` and a control in the UI.
6. Extend `summarizeWindow` in `domain/summary.ts` if it belongs in daily totals.
7. Extend `EventEditSheet` so the entry can be corrected.

`tsc` will fail on any switch you missed — `noFallthroughCasesInSwitch` and
exhaustive unions are doing real work here. No database migration is needed for a
new event type, since events share one object store.

## Things to be careful with

- **Never store a duration where a start and end will do**, and never store local
  time. Both lose information.
- **Never let a summary silently exceed its window.** There is a test for the
  24-hour case specifically.
- **Never add a network call.** If a feature seems to need one, it belongs behind
  the optional sync layer in v0.3, off by default, and it needs discussion in an
  issue first.
- **Never add an analytics or crash-reporting SDK.** This is a hard project rule,
  not a preference.
