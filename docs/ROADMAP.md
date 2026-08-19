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

- [x] Weight, length/height, head circumference, in metric or imperial
- [x] WHO percentile charts — weight-for-age to 5 years, length-for-age to 2
      years, both sexes, from the WHO's own LMS tables. CDC (2y+) still to source
- [x] Growth velocity (gain per week between weigh-ins)
- [ ] Birth stats as an explicit baseline
- [ ] Premature baby support: corrected age and Fenton preterm charts
- [x] Interval reminders: next feed, diaper, pumping, custom (vitamin D drops,
      tummy time), anchored to your own log
- [x] Snoozeable reminders, with mark-done and per-reminder on/off
- [ ] Home screen widgets for zero-open logging
- [ ] Waking a *closed* app when a reminder falls due. Not possible for a
      serverless PWA: web push needs a server holding a subscription, and
      Notification Triggers was withdrawn before it shipped. It would arrive with
      a native shell (Capacitor) or, opt-in, with the v0.3 sync server.

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

## Shipped outside the version tracks

- [x] **i18n foundation** — every string extracted to a catalogue, plurals via
      `Intl.PluralRules`, locale-aware clocks and numbers, a language picker, and
      a drift test that fails when a locale falls behind English. English and
      Spanish ship; Spanish is flagged in-app as awaiting native review.
- [x] **WHO growth reference data** — real LMS tables for weight-for-age (0–60
      months) and length-for-age (0–24 months), both sexes, extracted from the
      WHO's own spreadsheets by a committed, re-runnable script. Head
      circumference is **not** included: it was absent from the source set, and
      inventing reference numbers for a measurement parents show to doctors is
      not something this project will do.

## Languages, in priority order

The plumbing is done; a new language is one file in `src/i18n/messages/` plus an
entry in `locales.ts`. **Help especially wanted.**

1. **Tamil (ta)** — next up, and the priority.
2. **Hindi (hi), Telugu (te), Kannada (kn), Malayalam (ml), Bengali (bn), Marathi
   (mr)** — Indian languages ahead of European ones. India has more births per
   year than any other country and almost no baby tracker speaks these languages.
3. Everything else, as people bring it.

Spanish shipped first only because it proved the plumbing — plurals, accents,
placeholder parity and a 24-hour clock — in a language the drift tests could
check. It is still awaiting native review, and that review is welcome, but it was
never meant to signal that European languages come first.

## Always

- [ ] More translations, in the order above
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
