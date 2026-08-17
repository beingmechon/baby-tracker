# Changelog

All notable changes are recorded here. This project follows
[semantic versioning](https://semver.org/) once it reaches 1.0; until then, minor
versions may change behaviour.

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
