# Changelog

All notable changes are recorded here. This project follows
[semantic versioning](https://semver.org/) once it reaches 1.0; until then, minor
versions may change behaviour.

## Unreleased

### Added

- **A thirty-day view on the daily-sleep chart**, toggled from the section rule. A
  week is too short to show a routine settling — or failing to; a month is where that
  becomes visible. The weekday initials are dropped at that length, because thirty of
  them is a grey smear rather than an axis.
- The chart's text alternative now names the span it covers, so a screen-reader user
  hearing "daily sleep" knows whether it is a week or a month.
- **PDF export** is marked shipped: the print path on the handover and symptom
  screens is what "save as PDF" uses. Bundling a PDF writer would be a large
  dependency doing what the operating system already does.

### Changed — the roadmap says why the blocked things are blocked

- **Voice logging is blocked, not merely unstarted.** Chrome's Web Speech API sends
  audio to Google's servers to be transcribed, which is exactly what this app
  promises not to do. It waits for genuinely on-device recognition in a browser, or
  an offline model in the Android shell.
- The REST API, Home Assistant and MCP items are re-scoped as depending on the v0.3
  sync server, because every one of them needs a server and this app does not have
  one.
- The CDC milestone checklist is split out as needing sourcing, under the same rule
  that governed the WHO growth tables: developmental milestones shown to a worried
  parent get transcribed exactly or not at all.


### Added — activities and potty training

- **Tummy time, counted against a goal you set yourself.** The screen says the
  number in the field was typed by a person and repeats what health services suggest
  without turning it into the app's own instruction. Whether the goal was met takes
  the accent on the words and nothing else: a green tick and a red cross would turn
  a parent's day into a pass or a fail, which is not what a tummy-time counter is
  for.
- **Baths, walks, play and reading**, from a short fixed list rather than free text —
  counting them only works if every entry is the same word. An activity nobody timed
  is counted without a duration being invented for it.
- **Potty training**: successes, accidents, and sits where nothing happened, which
  are worth logging because a week of them shows a pattern nobody could hold in their
  head. Plus the best run of consecutive accident-free days.
- **A day nobody logged does not count towards a clean run.** A fortnight of silence
  is not a fortnight without accidents, and claiming it would turn the one number a
  parent might feel proud of into a lie.
- **A record, not a scoreboard**, said on screen every time the numbers appear.
  Accidents are part of learning, and a parent counting them at the end of a hard day
  should not find an app grading them.
- The place is not asked for after an accident: where they were sitting is not the
  point, and "Accident · on the potty" reads as a contradiction.

### Fixed

- **"Best run without an accident" was long enough to wrap its own value onto two
  lines**, which reads as a broken row. Shortened, and the browser suite now checks
  that no ledger value is wrapped mid-phrase by an over-long label — a whole class of
  layout fault rather than this one instance.


### Added — solids and the nine major allergens

- **A solids log**: what you offered, how much actually went in, and which of the
  nine major allergens it contained.
- **An allergen ledger** answering the question asked at every appointment from six
  months that no parent can answer from memory: has she had egg? peanut? when? Nine
  rows, each showing not-offered / no-reaction-noted / reaction-noted, how many
  times, and which food it was in.
- **The app never infers what is in a food.** Allergens are tagged by the parent, and
  the sheet says so where they tag. There is no food-composition database here and
  there will not be one: guessing that hummus contains sesame happens to be right,
  and guessing that a supermarket biscuit contains no egg is how an app tells a
  parent something dangerous and untrue. The browser suite asserts that logging
  "Peanut butter toast" untagged leaves peanut showing as not offered.
- **"No reaction noted", never "tolerated".** Tolerance is a clinical conclusion
  drawn from a controlled introduction; what the app knows is that a food was offered
  n times and nobody wrote down a reaction. There is no threshold above which it
  declares a child tolerant, because inventing one would be inventing medicine.
- **A reaction is a flag, not a severity.** Grading a reaction is triage. What it
  looked like goes in the note, and ticking the box surfaces the one thing worth
  saying out loud — that breathing trouble, facial swelling or repeated vomiting
  after a food is emergency care, not an app. Shown only when the box is ticked: an
  emergency instruction printed under every ordinary banana teaches a parent to stop
  reading it.
- A logged reaction stays flagged even if later offerings went fine. Silently
  clearing it would be the worst kind of helpful.
- The list is the nine named in United States federal law — the eight of the 2004
  labelling act plus sesame, added in 2023 — and the screen says so, along with the
  fact that other countries name more and that what to introduce when is a
  conversation with a doctor.

### Fixed

- **"last offered 0 minutes ago"** — the span formatter renders a sub-minute gap as
  "0 minutes", where the elapsed-time formatter already says "just now". Swapped, and
  the phrase no longer supplies its own "ago" on top of a value that ends in one.
  Fourth instance of that composition fault; guarded in the suite with the others.
- **Two notes in a row ran together as one wall of grey.** Consecutive field notes
  are separate points and are now spaced as such — everywhere, not just here.
- The nine allergen rows were padded to thumb height despite nothing in them being
  tappable, which cost half a screen for no benefit.
- A reaction flag collected by the food sheet was never passed to the store — caught
  before it shipped, but it was written as though deliberate, with a comment
  rationalising it.


### Added — twins mode and birth measurements

- **Twins mode.** Tick two or more babies in Settings and one tap logs a feed or a
  diaper for all of them. Twin parents are the most sleep-deprived users this app
  has and the least served by every tracker on the market; logging the same change
  twice, from two screens, at 4am is the friction that makes a parent stop logging.
- **A group, not a direction.** "These babies are logged together" reads the same
  whichever twin is on screen, where an "also log for…" setting attached to one baby
  would mean something different depending on which one you had open. A baby outside
  the group is unaffected, so twins plus an older child works with the setting left
  on permanently.
- **A shared action fans out; a record about one body never does.** Feeds and
  diapers copy. Weights, temperatures, symptoms and **medicine** do not — a
  duplicated dose would put a record in a second child's medical log saying they
  received a drug they did not receive, which is the most consequential mistake this
  app could make. Pumping stays out because it is the parent's output and copying it
  would double-count the milk in the stash. Sleep stays out because a running timer
  belongs to one baby and twins do not wake at the same minute. The rule is stated
  in the settings screen, next to the switch, and asserted in the browser suite.
- **Birth measurements as an explicit baseline**, stored as ordinary growth events
  dated at birth rather than as extra fields on the baby — so they plot as the first
  point on the chart, feed the gain-per-week maths, and export to CSV with no
  special case anywhere. The growth screen offers to add them only when there is a
  birth date to date them with and nothing recorded yet.
- **"+2.4 kg since birth"** in the growth ledger: the comparison every appointment
  opens with, and the one a chart of two dots cannot show. Negative in the first
  fortnight, which is normal and is not hidden.

### Fixed

- **"at born today"** in the growth history — the birth row was running its own date
  through the age formatter, composing a phrase inside a phrase. It says "at birth".
  Third instance of this fault after "Wet diaper diaper" and "just now ago", and now
  guarded in the browser suite alongside them.
- **The ledger said the same thing twice.** With only two readings the previous one
  *is* the birth measurement, so "+2.4 kg since Jun 20" and "+2.4 kg since birth"
  were one sentence printed twice. The birth row appears only when it adds something.
- **Saving a measurement from the growth screen confirmed nothing** — the same action
  from the home screen showed a toast, so a weight typed on the growth screen looked
  like it had been swallowed. Long-standing; found because the birth-measurement flow
  exists only there.
- A duplicate ISO-birth-date parser in the growth screen, which was a second
  implementation of the validated one in `domain/time.ts`. There is one now.


### Added — a real Android app

- **The same web build, in a Capacitor shell.** No second codebase, no separate
  native UI, no feature that exists on only one platform — with one exception, which
  is the entire reason the shell exists.
- **Reminders now wake a closed app.** A page can raise a notification while it is
  running; nothing in a browser can wake an app you closed two hours ago, because
  web push needs a server holding a subscription and Notification Triggers was
  withdrawn before it shipped. The shell hands the due times to Android's own alarm
  scheduler instead, which fires them whether the app is open, backgrounded or dead.
  **Still no server** — the alarm is held by your phone. This closes the one item on
  the roadmap that was marked impossible.
- **What gets handed over is a pure function** (`domain/scheduling.ts`), so it is
  tested without a device: nothing disabled, nothing already overdue (the screen
  already says overdue, and an alarm for a past moment adds nothing), nothing beyond
  a day out, and an unchanged plan is not re-issued — the clock ticks every twenty
  seconds and rewriting the same three alarms three times a minute for months is
  what shows up in a battery report.
- **The reminders screen now tells the truth for the platform it is on.** On the web
  it still says a closed app cannot be woken; in the shell it says the alarm is held
  by Android. Shipping one sentence for both would have made one of them a lie.
- **An APK from CI on every push**, downloadable from the Actions run — no Android
  SDK, no Mac, no developer account, nothing to pay. Debug-signed on purpose: a
  release build needs a signing key, and a signing key in a public repository is a
  key anyone can publish updates with. `android/.gitignore` now refuses keystores
  outright rather than leaving it commented out.
- **F-Droid metadata**, which is the intended home: it builds from source, signs
  with its own key, and needs no account. The app qualifies without compromise —
  AGPL-3.0, no proprietary dependencies, no analytics, no network calls. Capacitor
  is MIT.
- `SCHEDULE_EXACT_ALARM` is requested so a 3am reminder lands at 3am rather than
  whenever Android next wakes up, and denying it makes reminders approximate rather
  than broken. `USE_EXACT_ALARM`, the auto-granted variant, is deliberately **not**
  requested: it is for alarm clocks and calendars, and a feed reminder is neither.
- **No iOS target, deliberately.** It would need a Mac and a paid Apple account
  renewed yearly, which no open-source project should require in order to ship, and
  which would lock out any contributor without a Mac. Moved to non-goals along with
  everything that follows from it. On iOS the installed PWA still works offline and
  keeps its data.
- The shell adds nothing to the web build, and that is now enforced rather than
  claimed: `scripts/check-web-payload.mjs` asserts against the real `dist/` that the
  bridge stays out of the entry's static imports, out of index.html's preloads and
  out of the service-worker precache — while still being present and reachable, so
  it cannot pass by the feature having been deleted. It runs in `npm run check` and
  in CI.
- The Android version is generated from package.json with a CI check that rejects
  drift, the same guard the icons and vendored fonts already had.

### Fixed

- **The first attempt at splitting the Capacitor bridge did the exact opposite of
  what it claimed.** Grouping it with Rollup's `manualChunks` made the chunk a
  *static* dependency of the entry, so browsers preloaded an Android bridge they can
  never execute — and because it had also been excluded from the precache, the app
  **stopped loading offline entirely**. The build succeeded and the bundle report
  looked smaller; every unit test passed. Only the offline smoke test caught it.
  Naming the chunks without grouping them leaves the module graph untouched, and the
  new payload check fails on the bad version, which was verified by reintroducing it.
- `@capacitor/cli` and `@capacitor/android` were installed as runtime dependencies
  rather than build-time ones. They are devDependencies now; `npm audit --omit=dev`
  reports zero vulnerabilities, and the `tar` advisories the CLI pulls in stay on the
  build machine where they belong.


### Added — a symptom diary and doctor visits

- **A symptom diary that answers the question every doctor opens with.** Entries
  group into *episodes*, so "when did this start and how has it been since?" is
  answered with "cough, four days, worse yesterday" rather than twelve scattered
  lines. A gap of two days ends an episode — otherwise one endless "cough" runs
  from birth and the answer is useless.
- **The impression beside a symptom is the parent's own word**, and the sheet says
  so at the point of entry. Nothing is scored, ranked, triaged or flagged from it;
  it is not colour-coded into a verdict; the only places it goes are back onto the
  screen and onto paper. The episode reports the worst the parent called it, which
  is what gets asked, not the latest.
- **Doctor visits, which may be in the future.** This is the first event type that
  is *expected* to be, because the whole point of a questions list is that you
  write one down at 3am and ask it next Tuesday. Upcoming visits sort
  soonest-first, past ones newest-first.
- **Questions you tick off in the room.** A checkbox with the whole row as the
  target, at full tap height, because this is the one list in the app that gets
  used one-handed while somebody is talking to you. An asked question is struck
  through rather than removed: what you already covered is part of the record.
- **Printable for the appointment** — the questions plus the last two weeks of
  symptoms, which are the two things you get asked for across a desk. A printed
  checkbox renders as an outlined box to tick with a pen rather than a filled
  square.
- The home screen shows the next appointment and how far off it is.
- Symptoms and visits export to CSV with the rest of the log, questions included.

### Fixed

- **`SymptomEvent` declared its own `note` field, silently colliding with the
  `note` every event already carries** — one property with two meanings. Worse,
  the collision made the field look non-optional to the type checker while being
  absent at runtime, so the CSV row builder called `.trim()` on `undefined` and
  **one symptom with no note took the entire export down**, not just its own row.
  Both new event types use the inherited `note` now, which also means they are
  editable through the ordinary edit sheet for free. There is a regression test
  that exports an event with the field deleted.
- **"undefined" printed onto the sheet a doctor reads**, from the same optional
  field compared against `''`. Folded through one helper, with a smoke check that
  neither "undefined" nor "null" appears on the screen or the printed sheet.
- "first noted 2 days" now reads "first noted 2 days ago". The span formatter
  returns a bare duration by design, so the phrase has to supply the "ago" —
  the mirror image of the "just now ago" bug in v0.4, and guarded the same way.


### Added — the handover

- **A handover screen**, for the thing that actually happens at the door: pick a
  shift — the last 4, 8 or 12 hours, or today — and see it in one screen.
- **"Right now" comes first, before any count.** When they last ate, whether they
  are asleep or when they woke, when they were last changed. Someone standing in a
  doorway with a bag over one shoulder needs those three times; "3 feeds" is
  context, not an instruction.
- **The last of each thing is reported even when it falls outside the window.** "No
  feeds in the last four hours" is useless. "Last fed at 09:15" is the same fact
  stated so the next person can act on it.
- **Copy as a message.** The handover renders as plain text — no markdown, no
  emoji, no table — because it gets pasted into WhatsApp or read out loud. The text
  is shown on screen rather than hidden behind the button, so a parent can read
  what they are about to send and select it by hand if the clipboard is refused.
  Copying reports honestly whether the browser allowed it.
- **Print or save as PDF**, because nurseries and childminders ask for paper. The
  print stylesheet drops the app bar and every button and forces black on white:
  printing a night-mode page as it appears would empty an ink cartridge.
- **Doses are listed, not counted.** "2 doses" is the wrong thing to hand over —
  the next caregiver needs to know what was given and when, so they do not give it
  again. Temperature readings likewise.
- The daily summary now also aggregates pumping, medication and temperature, which
  is what made all of the above a summary rather than a second implementation.

### Fixed

- **The handover message could contain a double blank line**, which reads as a
  broken message once it lands in someone's chat. It was built by pushing
  separators between blocks as they were added; it is now three blocks joined by
  one blank line each, so the gap cannot happen. Caught by its own test.
- **One medicine listed twice under two spellings.** The health screen has grouped
  "Calpol" and "calpol " as one bottle since v0.4, but the handover listed raw
  names — and two spellings side by side reads as two different things having been
  given, which is the one mistake a handover must not make. The grouping key is now
  shared, and each administration keeps its own line and time.


### Added — sleep patterns, the day wheel and the week

- **The next nap, predicted from this baby's own log.** The median gap between
  waking and the next nap, added to when they last woke. No model, no population
  average, no server — and the screen shows its reasoning ("from a typical 1h 40m
  awake, over 6 wake windows") rather than presenting a time and expecting to be
  believed. This is the feature one popular tracker charges $69 a year for.
- **It declines to guess.** No prediction while the baby is asleep, none during
  your night hours (the next sleep is bedtime, and nobody needs an app for that),
  and none at all from fewer than three completed wake windows. The likely window
  either side comes from the interquartile range of this baby's own wake windows,
  so a steady routine gives a narrow range and a chaotic week gives a wide one and
  says so.
- **Only nap-preceding gaps count.** The wake window before bedtime is reliably the
  longest of the day; mixing it in would push every prediction later than the
  baby's actual routine.
- **A 24-hour day wheel.** Midnight at the top, running clockwise: sleep as arcs on
  the rim, feeds and diapers as tick marks in their own categorical colours, a tick
  for where "now" is, and the day's total sleep set in the middle of the ring. A
  night that crosses midnight is clipped to each day it spans, so it draws
  correctly on both instead of wrapping over itself. Step back through previous
  days; you cannot step into tomorrow.
- **The last seven days**, nights and naps stacked so a short day reads at a glance
  as a lost nap or a broken night, plus the trend in night sleep against the week
  before — medians, so one missed log does not read as a week of lost sleep.
- **Cluster feeding, named.** Three or more feeds inside three hours is reported as
  what it is, with a line saying that clusters are common. It is alarming the first
  time and completely normal.
- **A gentle deviation note** when today is a quarter off the trailing median, and
  deliberately hard to trigger: at least four days of history and half a day
  elapsed. A tracker that remarks on every ordinary fluctuation teaches you to
  ignore it. Every time it appears it says it is a note about a log, not a
  judgement about a baby.
- Plain SVG again, for the ring as for the growth chart. A polar chart library
  would have been the largest dependency in the project, for arcs and tick marks.

### Fixed

- **The week chart normalised to its own tallest day**, so a week containing one
  short nap drew the same full-height column as a week of solid nights. Bars are
  drawn against at least twelve hours now; the figure the screen *reports* is still
  the real observed peak.
- **A day with no sleep logged showed a dash above the word "asleep"**, which read
  as a figure that had gone missing rather than a day nobody wrote a nap down on.
  It says so in words. Seven empty columns is likewise a sentence now, not a chart
  of nothing.
- **The "now" marker was drawn from the centre of the wheel to the rim** and was
  the loudest thing on the screen — a scratch through the day rather than a
  position in it. It is a tick crossing the rim, and the rim marks have a faint
  track to sit on instead of floating.
- The cluster and deviation section had borrowed the screen's own title, so
  "Patterns" appeared twice; it has its own heading.

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
