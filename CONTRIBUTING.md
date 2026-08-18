# Contributing

Thank you for being here. This project exists because basic baby tracking got
locked behind subscriptions, and it gets better the more parents pitch in.

**You do not need to be an expert.** Some of the most valuable contributions are
not code at all: "this wording confused me at 3am", "this button is hard to reach
one-handed", "my country's vaccination schedule is different". If you have used
the app with a real baby, you know something the code does not.

## Ways to help

| If you have… | You could… |
| --- | --- |
| 10 minutes | Report a bug, or tell us what confused you |
| An hour | Translate the interface into your language — see below |
| Local knowledge | Add your country's vaccination schedule (v0.4) |
| A screen reader | Tell us what breaks — accessibility reports are gold |
| A weekend | Pick up something from the [roadmap](docs/ROADMAP.md) |

Look for issues labelled `good first issue` or `help wanted`. If you want to work
on something bigger, open an issue first so nobody duplicates your effort.

## Getting set up

You need Node 20 or newer. CI runs Node 22, the active LTS.

```bash
git clone https://github.com/beingmechon/baby-tracker.git
cd baby-tracker
npm install
npm run dev
```

That is all — no database, no API keys, no configuration.

```bash
npm test           # unit tests (fast; run these constantly)
npm run test:watch # unit tests, watching
npm run lint       # eslint
npm run typecheck  # tsc
npm run check      # lint + tests + production build, the same as CI
npm run build && npm run smoke   # end-to-end run in a real browser
```

`npm run check` is what CI runs. If it passes locally, your pull request should be
green.

## Before you write code

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). It is short, and it explains the
constraints that will otherwise seem arbitrary — particularly why the domain and
data layers must not import React, and why timestamps are always UTC epoch
milliseconds.

If your change touches anything visual, also read [docs/DESIGN.md](docs/DESIGN.md).
It is the design contract: the direction, the type and colour rules, the single
signature move, and a list of things this project must never do. Two things there
catch people out:

- **Do not hand-pick a colour.** The ramps are generated OKLCH output with WCAG
  contrast solved by construction. Nudging a hex by eye voids the guarantee.
- **Do not add a second decorative device.** One signature move, applied
  consistently, is the whole design. A new gradient, glow, or badge style is a
  regression even if it looks nice on its own.

## Adding or fixing a translation

This is the highest-value non-code contribution, and it needs no build tooling
knowledge.

1. Copy `src/i18n/messages/en.ts` to `src/i18n/messages/<code>.ts` and translate
   the values. Leave the keys alone.
2. Add an entry to `LOCALES` in `src/i18n/locales.ts`. Set `reviewed: false`
   until a native speaker has been through it — the app tells users when a
   translation is unreviewed, and that honesty matters more than looking finished.
3. Run `npm test`. `drift.test.ts` will tell you exactly which keys are missing,
   which have stray placeholders, and which plural forms are absent.

Notes that save time:

- **Keep every `{placeholder}`.** A dropped one means a number vanishes from the
  UI. The test catches this.
- **Plurals** use CLDR categories (`.one`, `.other`, and `.few` / `.many` where
  your language needs them). `.other` is the required fallback.
- **Do not translate by interpolating nouns into sentences.** If a phrase needs
  grammatical agreement, ask for separate keys instead — we did exactly that for
  the diaper toasts after "{kind} diaper logged" produced nonsense.
- **The medical-adjacent strings matter most.** Anything about growth,
  percentiles or wake windows must not sound like advice or a diagnosis in your
  language either. See docs/MEDICAL_DISCLAIMER.md.
- `npm run dev` and pick **Pseudo (testing)** in Settings → Language to see which
  strings are still hardcoded and where a longer translation would break the
  layout.

## The house rules

These are not negotiable, because they are the reason the project exists:

1. **No network calls.** The app makes none today beyond loading itself. If a
   feature seems to need one, it belongs behind the optional sync layer, off by
   default, discussed in an issue first.
2. **No analytics, telemetry, crash reporting or ad SDKs.** Ever, in any form,
   opt-in or otherwise.
3. **No paywalls.** Nothing about tracking your own baby gets gated.
4. **No medical advice.** The app may show a parent their own data and note that
   something is unusual for an age. It must never diagnose, and it must never
   instruct. Wording matters: "worth mentioning to your doctor", not "your baby is
   underweight".
5. **Dependencies are a cost.** Each one enlarges the offline bundle and the
   privacy audit surface. Prefer 30 lines of plain code to a package; if you need
   a package, say why in the pull request.

## Code conventions

- **TypeScript, strict.** No `any`, no non-null assertions without a comment
  explaining why the invariant holds.
- **Pure logic goes in `domain/`, with tests.** If a function needs the current
  time, pass `now` in as a parameter — do not read the clock inside it.
- **Comments explain _why_, not _what_.** The code already says what it does. A
  comment earns its place by capturing a decision, a constraint, or a trap.
- **Match the surrounding style** rather than introducing your own.
- Formatting is checked by eslint; there is no separate formatter step.

## Testing expectations

- Any change to `domain/` or `data/` needs unit tests. These are pure functions —
  testing them is easy and it is where the real bugs live.
- Build test timestamps with the `at()` factory in `src/test/factories.ts` so the
  suite stays timezone-independent.
- Test the awkward cases, not just the happy path. Midnight crossings, a running
  timer with no end, a clock that jumped backwards, an import file full of
  garbage. Every one of those has already been a real bug in some tracker.
- If you change UI flow, add a check to `scripts/smoke.mjs`.

## Accessibility and one-handed use

Every control must be reachable and usable:

- Minimum 56px tap targets; 72px for anything used in the dark.
- Every input needs a real associated `<label>`.
- Icon-only buttons need an `.sr-only` text label.
- It has to work at 200% system text size without clipping.
- It has to work with a screen reader.

If you are unsure, try using your change one-handed with the screen brightness at
its lowest. That is the actual usage environment.

## Pull requests

- Branch from the default branch, keep the change focused, and describe what a
  user would notice.
- Include a screenshot for anything visual, in both light and night mode.
- Make sure `npm run check` passes.
- Small pull requests get reviewed faster than large ones. Splitting is welcome.

By contributing, you agree your work is licensed under the project's
[AGPL-3.0-or-later](./LICENSE).

## Reporting bugs

Use the issue templates. The single most useful thing you can include is what you
expected to happen versus what happened, plus your device and browser.

**Never paste real data about your child into an issue.** If a bug needs an export
to reproduce, say so and we will find a way to handle it privately — see
[SECURITY.md](SECURITY.md).

## Being decent to each other

Parents in this project are frequently exhausted and often asking for help with
something they find stressful. Be kind, be patient, assume good faith. See
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
