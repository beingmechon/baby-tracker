# Changelog

All notable changes are recorded here. This project follows
[semantic versioning](https://semver.org/) once it reaches 1.0; until then, minor
versions may change behaviour.

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
