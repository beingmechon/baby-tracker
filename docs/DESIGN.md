# Design: Herbarium Grid

**Date:** 2026-08-17 · **Status:** confirmed
**Archetype:** Caregiver · **Register:** product structure · expressive at: the running timer, the empty timeline
**Grounding:** A Swiss pharmaceutical insert's module discipline + a herbarium label's warm ochre materials
**DNA:** Organic / Natural + type voice and motion borrowed from Data-Dense Professional · **Dominant axis:** type voice
**Composition:** dealt — Organic/Natural × **Swiss Modular**, variance 3, seed `baby-tracker|2026-08-17|1`
**Pins:** none. The hand is executed as dealt — family, discipline, hue and signature all unmodified.

Derived with the doctrine in [ryanthedev/design-for-ai](https://github.com/ryanthedev/design-for-ai)
(MIT), whose AI-tell catalog ports rules from
[pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0).
The dealer ledger, including the rejected first hand, is in `docs/used-dna.json`.

---

## Direction

A baby's day recorded on a strict grid, in warm natural materials. Beeswax, bark,
stone and dried grass — no pure white, no pure black, nothing that looks like a
screen if it can look like paper. Everything is seated flush-left on one module
grid, and the numbers are set in a serif because in this app the numbers are the
whole point: how long, how much, how many, how long ago.

It serves a parent who is exhausted, often anxious, and holding a baby. The
structure stays quiet and disciplined so that one thing can be loud: the timer that
is running right now.

## Deal history

| Round | Hand | Outcome |
| --- | --- | --- |
| `reroll 0` | Warm Editorial × Ledger Grid × lime 128.6 | **Rejected** by the user on the composition axis. Re-dealt rather than edited, per the re-deal protocol. |
| `reroll 1` | Organic/Natural × Swiss Modular × yellow 71.8 | **Locked.** Executed as dealt. |

The second hand is a better fit on every axis, and needed no deviations:

- **Organic / Natural is a Caregiver primary family** — the archetype no longer has
  to be argued for.
- **Swiss Modular suits a phone.** A single-column module grid, flush-left and
  rag-right, is how a one-handed app should be laid out; Ledger Grid wanted dense
  tabular columns that a 390px viewport cannot give it. Variance 3 keeps the
  structure calm, which is right for 3am.
- **The dealt hue is already warm**, so it carries light, dark *and* the red-shifted
  night theme as one family. Round one needed a hue swap to achieve that; this hand
  did not, so `Pins: none`.

## Signature move

**Section labels interrupt their own top rule, like a legend on a map frame.**

Every section is introduced by a hairline rule across the full measure, with the
label sitting *on* the rule and the rule broken around it. The rules define the
modules of the grid; the label-gaps are the only ornament in the design. One move,
applied to every section on every screen.

## Expressive moments

Everything not listed here holds the calm product register: modest ratio-locked
size jumps, rank by position and weight rather than scale.

| Moment | What turns up |
| --- | --- |
| **A running timer** (sleep in progress, nursing stopwatch) | The one place scale breaks the grid's modesty. The numeral jumps to the top of the type scale and takes the accent. This is the genuine emotional peak — it is the number you opened the app to read. |
| **The empty timeline** | A ruled but unfilled grid, rules visible, one quiet line of copy. The emptiness is the message: nothing has happened yet today. |

## Type

The borrowed axis, and the dominant one. The collision *is* the typography: the base
family's warmth carries the protagonist, the borrowed family's discipline carries the
apparatus.

- **Numerals and display: Literata Variable** (`@fontsource-variable/literata`,
  self-hosted). Every digit in the app — times, durations, volumes, counts — is
  Literata. A reading face built for long sessions at small sizes, with sturdy
  figures that hold up both at 13px in the timeline and at 61px on a running timer.

  **Not Fraunces**, which the archetype tables recommend for both Organic/Natural
  and Warm Editorial. Two measured reasons, found after it was already implemented:

  1. **Fraunces ships no `tnum` feature.** `font-variant-numeric: tabular-nums`
     silently does nothing, and a running stopwatch visibly jitters as its digits
     change — the exact defect this section forbids. Measured by rendering
     `000000` against `111111`: Fraunces drifts 79.3px at 64px type, Literata 0px.
     `scripts/smoke.mjs` now guards this permanently.
  2. **The AI-tell detector lists Fraunces** among converged default faces
     (`Inter|Roboto|…|Fraunces|Space Grotesk|Instrument Serif`). This is the decay
     doctrine playing out inside the doctrine itself: `archetypes.md` recommends
     the font that `ai-tells.md` now flags. The detector is the fresher signal.
- **Labels, prose and chrome: Archivo Variable** (`@fontsource-variable/archivo`,
  self-hosted). Data-Dense Professional's documented compact grotesque: quiet,
  disciplined, recedes behind the numbers.
- **Never:** Inter, Roboto, Open Sans, Lato, Montserrat, `system-ui` as a primary
  face, Space Grotesk, Instrument Serif/Sans, Recoleta, Geist, Fraunces.
- **Any future face must pass both gates:** absent from the detector's
  `OVERUSED_FONTS` list, and measurably tabular. Neither is a matter of taste.
- **Tabular figures are mandatory** (`font-variant-numeric: tabular-nums`) on every
  numeral. A stopwatch must not change width as it ticks.
- **Scale:** 1.25 (major third) from 16px —
  `0.8 · 1 · 1.25 · 1.5625 · 1.953 · 2.441 · 3.052 · 3.815rem`.
  The grid uses the bottom three steps; the top step is reserved for the running
  timer.
- **Leading:** 1.5 prose / 1.05 display · **Weights:** Archivo 400/500/600, Literata 400/600
- **Labels:** 0.8rem Archivo, letterspaced 0.08em, `--text-secondary`

Fonts are bundled, never fetched — 85KB of `latin` `wght` cuts, vendored by
`npm run fonts` so the offline payload is exactly auditable. A CDN font would be a
network request, which this project does not make (CONTRIBUTING.md), and it would
fail offline — the one thing the app must never do. `latin-ext` lands with i18n.

## Color tokens

Generated by `scripts/palette.mjs --seed 71.8 --chroma muted --harmony analogous`
— OKLCH ramps with WCAG contrast solved by construction. Light and dark blocks are
used verbatim in `src/styles/tokens.css`. `muted` chroma is Organic/Natural's
requirement: desaturated naturals, no pure anything.

| Role | Light | What it is |
| --- | --- | --- |
| paper | `#fdfdfc` → `#f9f8f7` | warm off-white, never `#fff` |
| ink | `#302d2a` | warm dark, never `#000` |
| accent | `#d6b081` | beeswax / dried clay |
| feed tint | `#cd886d` | muted terracotta — **data only** |
| diaper tint | `#c2ba7c` | dried grass — **data only** |

**Accent scarcity.** The ochre accent appears **only** on a running timer and the
primary action of the current screen. Nowhere else. If two things on a screen are
ochre, one of them is wrong.

**Categorical colour is data, never chrome** — Data-Dense Professional's own rule.
The three event kinds are tinted only on the timeline badge, which encodes a data
row, and never on a control. Sleep takes deep neutral ink rather than a hue: sleep is
the absence of activity. Buttons carry no category colour at all — a deliberate
reversal of v0.1, where every control was tinted and nothing therefore stood out.

**Contrast** (generator report, WCAG 2.x — 16/16 pass):

```
PASS [light] neutral-11 on neutral-2      5.69:1    PASS [dark] neutral-11 on neutral-2      8.74:1
PASS [light] neutral-12 on neutral-2     12.92:1    PASS [dark] neutral-12 on neutral-2     14.25:1
PASS [light] neutral-12 on neutral-3        12:1    PASS [dark] neutral-12 on neutral-3     12.94:1
PASS [light] accent-11 on neutral-2       5.72:1    PASS [dark] accent-11 on neutral-2       8.71:1
PASS [light] accent-11 on accent-2        5.72:1    PASS [dark] accent-11 on accent-2        8.71:1
PASS [light] accent-on-solid on accent-9  9.61:1    PASS [dark] accent-on-solid on accent-9  9.61:1
PASS [light] orange-11 on neutral-2       5.81:1    PASS [dark] orange-11 on neutral-2        8.6:1
PASS [light] yellow-11 on neutral-2       5.65:1    PASS [dark] yellow-11 on neutral-2        8.8:1
```

The **night** theme is this project's own third block, not generated: it holds hue
71.8's family, drops lightness far down and shifts warm, leaving no meaningful blue
channel. Because it is hand-built, its contrast is *measured in the browser* by
`scripts/smoke.mjs` rather than asserted here.

## Space, shape, depth

- **Spacing:** a 3:4 varied scale (×0.75 decay from 64px) —
  `64 · 48 · 36 · 27 · 20 · 15 · 11 · 8 · 6 · 5`. Deliberately *not* a uniform
  4/8/16 grid: v0.1 used ~12px for 64% of its gaps and the detector flagged it as
  `monotonous-spacing`. Tight within a group, generous between groups — white space
  is the primary hierarchy signal (ch07).
- **Radius:** 3px on pressable things, 0 on rules and rows. A stamped form, not a
  stack of cards. The dealt composition governs shape, so Organic's soft blob
  shapes are overruled.
- **Borders:** hairlines (1px `--border-subtle`) are the structure. **No boxed
  cards.** Tufte's 1+1=3 — where space and a rule already separate two things, a
  four-sided border is noise (ch07, Critical).
- **Shadows:** essentially none; depth is rules and space. The one shadow, on the
  bottom sheet, is hue-shifted warm-dark rather than `rgb(0 0 0 / x)`. Identical
  shadows everywhere is a catalogued tell; here there is nothing to make identical.
- **Alignment:** flush-left, rag-right, everywhere. Nothing is centred. Centring is
  the absence of a layout decision (ch06).

## Motion

The second borrowed axis. Organic/Natural's own vocabulary — slow 400ms+ drifts and
growth metaphors — is wrong for a product surface used at 3am, so motion comes from
Data-Dense Professional: state-change only.

- **Timing:** 120ms state changes · 200ms sheet entrance · **Easing:** `ease-out`,
  `cubic-bezier(0.2, 0.9, 0.3, 1)`
- **Allowed:** press states, the sheet sliding up, the toast.
- **Never:** bounce or elastic easing (catalogued tell), ambient motion of any kind,
  fade-in-from-below on load, hover effects on everything, animated drifts.
- **prefers-reduced-motion:** durations collapse to ~0. Nothing is lost, because no
  information is carried by motion.

## Never (this project's tells at risk)

- **Cyan/teal accent** — v0.1 shipped `#0f766e`, one step from the catalogued
  cyan-on-dark palette. Gone.
- **Everything in cards** — v0.1 boxed status, actions, summary, timeline and
  settings identically. This produced the measured `nested-cards` finding. Replaced
  by rules.
- **Uniform spacing** — the measured `monotonous-spacing` finding. Fixed by the
  0.75 varied scale.
- **`system-ui` as the primary face** — a typography tell that v0.1 shipped.
- **Glassmorphism** — v0.1's app bar used `backdrop-filter: blur()`. The bar is now
  opaque paper with a hairline.
- **A second accent hue** — the Data-Dense borrow tempts categorical colour onto
  chrome. Categorical tints stay on data rows.
- **The cream + serif + terracotta cluster** — a serif on warm paper sits near it.
  Held off by a muted beeswax accent rather than terracotta, and paper at `#fdfdfc`
  rather than cream `#F4F1EA`. Worth re-checking if the accent ever gains chroma.
- **Over-correction** — per the decay doctrine, dodging every catalogued hex while
  looking like every other anti-slop pass is still a failure. The test is variance,
  not distance from a ban-list.

## Resolved

- **Percentile bands on the growth chart** were an open question: how to separate
  three reference curves without either a second accent hue or a chart-only palette
  extension. The answer turned out not to need colour at all. The reference curves
  are *context*, not data — they belong to the frame, like the hairline rules — so
  they are drawn in `--border-subtle`, with the median distinguished by a dash
  pattern rather than a hue. The single accent stays on the one line that is
  actually the baby's. No palette extension was needed.

## Open questions

- `latin-ext` subsets are not bundled yet, so a name using glyphs outside `latin`
  falls back to the system serif for those characters. This lands with i18n.
