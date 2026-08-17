# Roadmap

The full feature plan, from the project spec, broken into shippable versions.
Everything here is up for grabs — if you want to build one of these, open an issue
saying so and it is yours.

The guiding rule is **ship early, ship small**: each version should be genuinely
usable on its own, because the fastest way to find out whether a tracker works is
to use it with a real baby at 4am.

## v0.1 — Core logging ✅ shipped

- [x] Nursing timer, per side, remembers and alternates sides
- [x] Bottle logging: breast milk vs formula, ml/oz, one-tap amounts
- [x] Sleep timer with nap/night auto-detection, survives app close
- [x] Diapers: wet / dirty / mixed / dry, one tap each
- [x] Quick-log: one tap repeats the last feed
- [x] Unified, editable timeline
- [x] Daily summary: feeds, total and longest sleep, diaper counts
- [x] Wake-window display with age-based context
- [x] Night mode (dim, red-tinted), auto by time of day
- [x] Offline-first PWA, installable, no account
- [x] JSON backup and restore, CSV export, one-tap delete-everything
- [x] Accessible: real labels, focus handling, reduced-motion, dynamic type

## v0.2 — Growth and reminders

- [ ] Weight, length/height, head circumference
- [ ] WHO percentile charts (0–2y) and CDC (2y+) — both are public datasets
- [ ] Growth velocity view (gain per week), birth stats as the baseline
- [ ] Premature baby support: corrected age and Fenton preterm charts
- [ ] Interval reminders: next feed, pumping, custom (vitamin D drops, tummy time)
- [ ] Snoozeable reminders
- [ ] Home screen widgets for zero-open logging

## v0.3 — Multiple caregivers

- [ ] Multiple children, including a twins mode that logs both in one action
- [ ] Self-hosted sync server (Docker image, Postgres or SQLite)
- [ ] End-to-end encrypted relay as an alternative to self-hosting
- [ ] Roles: edit vs view-only
- [ ] Who-logged-what audit trail
- [ ] Handover summary: "since your shift: 2 feeds, 1 nap, 3 diapers"
- [ ] Daycare report: a printable or shareable daily summary
- [ ] Import from other apps (Baby Tracker, Huckleberry CSV)

The store already sits behind a single `Repository` interface and every event
carries a UUID and `updatedAt`, so sync can be added without rewriting the app.

## v0.4 — Health and medical

- [ ] Temperature log with age-appropriate fever thresholds
- [ ] Medication log: name, dose, time, "last given X hours ago", reminders
- [ ] Vaccination schedules, country-selectable: India (IAP), US (CDC), UK (NHS),
      WHO default — **help wanted from parents outside the US**
- [ ] Doctor visits: notes, questions-to-ask list, attached photos and reports
- [ ] Symptom and illness diary
- [ ] Teething tracker with a visual tooth chart
- [ ] Jaundice / phototherapy log — a common newborn need almost no app covers
- [ ] Configurable medical trackers (feeding tubes, breathing treatments) for
      special-needs babies

## v0.5 — Patterns and pumping

- [ ] Sleep predictions ("next nap likely around 2:15pm"), pattern-based and
      computed on-device. Paywalled elsewhere; free here, permanently.
- [ ] Pumping: per-side output, session timer
- [ ] Milk storage inventory: fridge/freezer stock, expiry warnings, oldest-first
- [ ] Cluster-feeding support: rapid consecutive logs with no friction
- [ ] 24-hour circular "day wheel" visualisation
- [ ] Weekly and monthly pattern charts
- [ ] Trends: "sleeping 40min longer at night than last week"
- [ ] Gentle deviation nudges — informational, never diagnostic

## v1.0 — Toddler and ecosystem

- [ ] Solid foods log: food tried, amount, reaction/allergy tag
- [ ] Allergen introduction tracker for the big nine, with introduced /
      tolerated / reacted status
- [ ] Food library with age-appropriate serving guidance
- [ ] Potty training: attempts, successes, reminders, streaks
- [ ] Chores and routines as the child grows
- [ ] Activities: tummy time with a daily goal, bath, walks, playtime, plus
      user-defined activity types
- [ ] Milestones: CDC checklist by age, a photo per milestone
- [ ] Photo journal / timeline
- [ ] Voice logging: "log 120ml bottle", on-device speech
- [ ] Public REST API and webhooks
- [ ] Home Assistant integration
- [ ] MCP server so AI assistants can log and query
- [ ] PDF export for paediatrician visits

## v1.x — Platform depth

- [ ] Apple Watch and Wear OS quick actions
- [ ] Live Activities (iOS lock-screen running timers)
- [ ] Siri Shortcuts and Google Assistant
- [ ] On-device AI logging: "she fed 10 min left side then napped" parsed into
      entries
- [ ] Grafana-friendly data endpoint
- [ ] Hardware hooks (ESP32 keypads, smart bottle scales — the Baby Buddy
      community has built both)
- [ ] Pregnancy stage: contraction timer, kick counter, due-date countdown,
      checklists, belly journal

## Always

- [ ] More translations — **help especially wanted**
- [ ] Accessibility improvements
- [ ] Keeping the bundle small enough to be genuinely offline-first
- [ ] Never adding an analytics SDK, an ad network, or a paywall

## Non-goals

Things we will not do, so nobody spends time on them:

- Accounts or logins as a requirement for any feature
- Advertising, sponsored content, or affiliate links
- Selling, sharing or aggregating anyone's data
- Diagnostic claims or medical advice
- Any paywall on tracking your own baby
