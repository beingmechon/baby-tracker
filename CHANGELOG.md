# Changelog

All notable changes are recorded here. This project follows
[semantic versioning](https://semver.org/) once it reaches 1.0; until then, minor
versions may change behaviour.

## Unreleased

### Added — temperature and medication

- **Temperature readings** with the site they were taken at, in °C or °F. Stored
  as hundredths of a degree Celsius, so a reading typed in Fahrenheit reads back as
  the number that was typed.
- **A reading is compared with a published figure, never diagnosed.** 38 °C is what
  the NHS, the CDC and the WHO all name as a fever, and the screen says that is
  what it is comparing against. It also says that armpit and forehead readings come
  in lower than a rectal one, and that health services differ.
- **The one case worth singling out.** For a baby under three months with a raised
  reading, the app reports that guidance is to contact a doctor without waiting,
  and says plainly that it cannot assess anyone. Leaving that unsaid in order to
  sound less medical would have been the more harmful choice. Age is judged at the
  reading, not today.
- **A medication log** with a free-text dose — millilitres, milligrams, drops, half
  a tablet — because a structured amount would be a precision the app does not
  have. Doses group by name, case- and space-insensitively, so "Calpol" and
  "calpol " are one medicine and "last given" answers the question correctly.
- Readings outside 30–45 °C are refused as a typo or a broken thermometer rather
  than stored where a doctor might read them.

### Fixed

- **"last given just now ago".** The template said "ago" and so did the value
  interpolated into it. The same mistake as the diaper toast in v0.2, and the same
  fix: a phrase goes in whole or not at all.
- **Two controls in the medication sheet shared one accessible name**, so a screen
  reader announced "What did you give?" for both the recent-medicine chips and the
  text field. The chips are labelled "Recently given" now.
- An important banner sat flush against the button below it and read as one block.

### Added — pumping and the milk stash

- **Pumping sessions** with a clock and per-side output. Both sides are recorded
  even when one is zero: a persistent difference between sides is something parents
  watch, and one total would throw it away. There is no per-side timing, because a
  double pump runs both at once.
- **A milk stash** for the fridge and freezer, listed in the order to use it.
  Add, use some, use it all, throw away. Totals per shelf.
- **Ordering by urgency, not by age.** Each container is compared against its own
  storage guideline, so a fridge bottle with hours left outranks a frozen bag
  months older. Sorting by raw age would put the old frozen bag first and quietly
  waste the fridge — that ordering is the whole point of the feature.
- **The time expressed is editable and separate from when it was logged.** Milk
  gets logged when a hand is free; the storage clock started when the pump
  stopped, and a few hours is the difference between "use today" and "past it".
- **The pumping reminder now anchors to the pumping log**, which it could not do
  before — it had no log to anchor to and could only count from itself.

Storage guidelines are the US CDC's published figures for freshly expressed milk,
4 days chilled and 6 months frozen. The screen says so, and tells the reader to
follow their own health service. The app describes dates; it does not tell anyone
what to do with their milk.

### Fixed

- **Six months of freezer life displayed as "4319h 59m".** The duration format was
  built for feeds and naps and topped out at hours. Long spans now read in days,
  weeks or months — the units a person would say out loud.
- **Three toasts claimed success before the write finished.** Snoozing a reminder,
  marking one done, and throwing milk away all announced the result without
  awaiting it, so a failed write would still have said it worked.

### Added — more than one baby

- **A switcher on the app bar.** The baby's name is the control; tapping it lists
  everyone, marks who is open, and offers to add another. It opens with one baby
  too, because that is how the second one gets added.
- **Add and delete babies.** Deleting one takes their entries, measurements and
  reminders with it and leaves the others alone. The per-baby delete only appears
  when another baby remains — with a single baby it would be indistinguishable from
  "delete all my data", which already exists and says so far more clearly.
- Every screen was already scoped by baby — events, growth, reminders — so this is
  mostly a way in. Two things genuinely needed fixing, both below.

### Fixed

- **A running nursing timer followed you to the other baby.** It was persisted
  under a single key, so with twins a feed started for one could be shown, and
  saved, as the other one's. Timers are now keyed per baby, and one left running
  across the upgrade is adopted by whichever baby is open rather than lost.
- **Switching baby briefly showed the previous baby's entries under the new
  name.** The id changes synchronously while the read from storage resolves a tick
  later. Loaded events and reminders are now tagged with whose they are and only
  rendered for that baby, so the gap shows an empty list instead of someone else's
  data.

### Added — reminders

- **Interval reminders** for the next feed, a diaper change, pumping, or anything
  you name yourself. Snooze, mark done, turn off.
- **A reminder counts from the last time you logged the thing**, not from when it
  last went off. Feeding the baby is therefore how you dismiss the feed reminder —
  an action a parent already performs, so there is nothing extra to remember.
- **Reminders show on the home screen** as well as their own, and survive a
  restart. The home screen deliberately has no checkbox and no tappable rows: a
  stray thumb there should not turn a reminder off or open an editor.
- **Local notifications**, with permission requested from a button on the
  reminders screen and never on load.

The reminders screen states the honest limit of a serverless app: alerts happen
while the app is open, including in the background once installed, but nothing can
wake a fully closed app without a server holding a push subscription. Anything that
fell due while you were away shows as overdue when you return.

Storage gained a `reminders` store, the schema's first migration. An export
written by v0.1 still imports, and the export format stays at version 1 so an
older build can still read a newer backup rather than refusing it.

### Added — growth tracking with real WHO percentiles

- **Weight, length and head circumference**, in metric or imperial. Imperial
  weight is entered and shown as two units ("9 lb 15 oz"), because that is how a
  scale reads and how a parent says it.
- **A growth screen** with the measurement as its headline, the date it was taken,
  the change since the previous reading as a per-week rate, and the WHO percentile
  for age.
- **A WHO percentile chart** — the baby's own readings plotted against the 3rd,
  50th and 97th percentile curves, drawn from the World Health Organization's
  published LMS parameters. Hand-drawn SVG; no charting dependency.
- **Sex on the baby's profile**, optional, used only to pick the right WHO
  reference. Percentiles are hidden rather than guessed when it is not set.
- **Growth rows in the CSV export**, in both metric and imperial columns.
- Measurements are editable and deletable like every other entry.

Percentiles are computed at the age the measurement was *taken*, not today's age,
so an old weigh-in does not appear to slide down the chart as the baby grows.

**Head circumference is tracked but has no percentile.** The reference was not in
the WHO source set this project extracted from, and inventing curves behind a
number a parent shows to a doctor is not something this project will do. The app
says so on screen.

### Changed

- Canonical storage for measurements is whole grams and whole millimetres — finer
  than any home scale or tape — so switching between metric and imperial can never
  drift a stored value.
- `describeEvent` takes a context object rather than a growing positional
  argument list.

### Added — internationalisation

- **Every string in the app is now translatable.** A dependency-free i18n core
  (~60 lines) built on `Intl`: plurals via `Intl.PluralRules`, locale-aware
  clocks and numbers, named `{placeholder}` interpolation, typed message keys so
  a typo fails to compile.
- **English and Spanish.** Spanish is labelled in the app as awaiting native
  review rather than presented as finished.
- **A pseudo-locale** (`Pseudo (testing)`, dev builds only) that accents and
  expands every string, so anything left hardcoded is visible on screen and
  English-only layouts show up immediately.
- **A language picker** in Settings, defaulting to the browser's languages.
  `lang` and `dir` are set on the document, so screen readers switch voice and a
  right-to-left locale can flip the layout.
- **Drift tests** that fail when a locale is missing keys, has stray keys,
  disagrees with English on placeholders, or lacks a plural fallback.
- **WHO growth reference data** — real LMS tables for weight-for-age (0–60
  months) and length-for-age (0–24 months), both sexes, plus the re-runnable
  extraction script. Groundwork for v0.2 percentiles.

### Changed

- `domain/` no longer contains a translatable string. `formatDuration`,
  `formatAgo` and `formatAge` are replaced by `splitDuration` and `describeAge`,
  which return numbers and structure; the words live in the message catalogue.
  This is the seam that makes localisation possible at all.
- `formatClock` takes a locale, so Spanish gets a 24-hour clock.
- **CSV exports now use 24-hour times.** An export is read by spreadsheets and by
  people in other countries, where "1:00" is ambiguous and "13:00" is not.
- The Settings footer version comes from `package.json` instead of a second copy
  that could go stale.

### Fixed

- The diaper toast read "Wet diaper diaper logged" once the label was
  interpolated into a template that already said "diaper". Replaced with
  whole-sentence messages per kind — interpolating nouns into sentences breaks
  casing and grammatical agreement in other languages regardless.

### Fixed

- **Snooze did nothing on the reminders most likely to be snoozed.** One field was
  serving as both "last alerted" and "last resolved", so raising an alert advanced
  the interval — and a ten-minute snooze was swallowed whole by a three-hour
  reschedule. Alerting, resolving and deferring are now three separate timestamps,
  and the case is a unit test.
- `npm run smoke` wrote its screenshots into the committed `docs/screenshots/`, so
  any local verification run dirtied the working tree. It now writes to a
  gitignored directory; `npm run screenshots` refreshes the committed images.

### Verified

329 unit tests (up from 156) and 80 browser smoke checks, including the WHO
percentile maths against the organization's own published −2SD and +2SD figures, a
metric-to-imperial round trip through storage, the v1-to-v2 schema migration
against a genuine version-1 database, and a real language switch. 0 AI-tell
findings across 22 rendered screens.

## [0.1.1] — 2026-08-17

A full design pass. No feature changes; every change below is visual, plus one real
typographic defect fixed.

### Added

- **A design contract**, [docs/DESIGN.md](docs/DESIGN.md) — a named direction
  ("Herbarium Grid"), its grounding, the four DNA axes, the register, and the one
  signature move. Implementation now has something to be checked against.
- **Self-hosted variable fonts** (Literata for every numeral, Archivo for prose),
  vendored into the repo so the offline payload is exactly auditable. 85KB.
- **Generated colour tokens** — OKLCH ramps with WCAG contrast solved by
  construction, 16/16 pairs passing, replacing hand-picked hexes.
- **A third theme block.** Light, dark, and a dim red-shifted night theme, all from
  one warm hue family.
- **The signature move**: section labels interrupt their own hairline rule, like a
  legend on a map frame.
- **Two new smoke checks** — that the bundled display face actually loads, and that
  its numerals are measurably tabular.
- `npm run fonts` and `scripts/snapshot.mjs`, plus CI guards against vendored-font
  drift.

### Changed

- **No more boxed cards.** Hairline rules and white space carry the structure.
- **The home screen leads with a headline**: the current status as the dominant
  typographic element, rather than a grid of four equal tiles.
- **The daily summary is a ledger**, not three boxed tiles.
- **Categorical colour moved off the chrome and onto the data.** Buttons no longer
  carry a category tint; only timeline marks do. One ochre accent now appears solely
  on a running timer and the primary action.
- Everything is flush-left. Nothing is centred.
- Spacing follows a 3:4 varied scale instead of a near-uniform 12px rhythm.

### Fixed

- **A running timer could visibly jitter.** The previous display face ships no
  `tnum` feature, so `font-variant-numeric: tabular-nums` silently did nothing and
  digits changed width as the clock ticked. Measured, fixed, and now guarded.
- Timeline notes ran on from the entry title instead of onto their own line.
- The app bar's `backdrop-filter` frosting is gone.

### Verified

Measured with the deterministic AI-tell detector from
[ryanthedev/design-for-ai](https://github.com/ryanthedev/design-for-ai) over
rendered DOM snapshots of 7 screens: **13 findings → 0**
(`nested-cards` ×6 high, `monotonous-spacing` ×7 medium, both eliminated).

[0.1.1]: https://github.com/beingmechon/baby-tracker/releases/tag/v0.1.1

## [0.1.0] — 2026-08-17

The first release. Deliberately small, and genuinely usable with a real baby.

### Added

**Feeding**
- Nursing stopwatch with per-side timing, pause and resume
- Remembers the last side used and suggests the other one
- Switching sides mid-feed saves each side as its own entry
- The running timer survives closing the app or locking the phone
- Bottle logging: breast milk or formula, one-tap amounts, ml or oz
- Repeat last feed in a single tap

**Sleep**
- One start/stop timer, stored as an open event so it survives a restart
- Automatic nap vs night classification from your own configured night hours
- Wake-window display with age-appropriate context

**Diapers**
- Wet, dirty and mixed in one tap each; dry available when editing

**Review**
- Unified timeline per day, with every entry editable and deletable
- Daily summary: feed count and volume, total and longest sleep, diaper counts
- Day-by-day navigation
- Sleep is attributed across midnight by overlap, so daily totals always add up

**Experience**
- Three themes: light, dark, and a dim red-tinted night theme that switches on
  automatically during your night hours
- 56px minimum tap targets, 72px for primary actions, built for one-handed use
- Offline-first PWA: installable, and fully functional with no connection
- No account, no sign-up, no analytics, no telemetry, no ads
- Screen-reader labels, focus management, reduced-motion support, dynamic type

**Your data**
- Complete JSON backup and restore
- CSV export for spreadsheets and paediatrician visits, hardened against
  spreadsheet formula injection
- Validated import that skips malformed records rather than corrupting the store
- One-tap deletion of all data

### Notes

- 156 unit tests cover the domain logic, storage layer, timer state machine,
  validation and formatting.
- A browser smoke test verifies the whole core loop and, specifically, that the
  app still loads and logs with the network switched off.

[0.1.0]: https://github.com/beingmechon/baby-tracker/releases/tag/v0.1.0
