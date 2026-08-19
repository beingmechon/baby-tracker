/**
 * English messages — the source of truth for every string in the app.
 *
 * Adding a key here makes it required in every other locale (see `drift.test.ts`),
 * which is deliberate: a missing translation should be a failing test, not a
 * surprise blank label at 3am.
 *
 * Conventions:
 *   - Keys are `area.thing`, lowercase, dot-separated.
 *   - `{placeholders}` are interpolated by name.
 *   - Plural forms end in `.one` / `.other` etc. and are selected via
 *     Intl.PluralRules. Always provide `.other`; it is the fallback.
 *   - Write for a tired parent: short, concrete, no jargon, no exclamation marks.
 */
export const en = {
  'app.name': 'Baby Tracker',

  // Onboarding
  'onboarding.tagline': 'A private record of your baby’s day.',
  'onboarding.lede':
    'Feeds, sleep and diapers in one tap. Everything stays on this device.',
  'onboarding.name.label': 'Baby’s name',
  'onboarding.name.placeholder': 'e.g. Mira',
  'onboarding.birthDate.label': 'Date of birth',
  'onboarding.birthDate.optional': '— optional',
  'onboarding.birthDate.note':
    'Used to show age and age-appropriate wake windows. You can add it later.',
  'onboarding.submit': 'Start tracking',
  'onboarding.submitting': 'Setting up…',
  'onboarding.promise.noAccount': 'No account, no sign-up, no ads, no analytics.',
  'onboarding.promise.offline':
    'Works fully offline. Your data never leaves this device.',
  'onboarding.promise.export': 'Export or delete everything at any time.',

  // Status headline
  'status.asleep': 'Asleep',
  'status.awake': 'Awake',
  'status.noSleepLogged': 'No sleep logged',
  'status.since': 'since {time}',
  'status.lastFeed': 'last feed {duration} ago',
  'status.nothingLogged': 'nothing logged yet',
  'status.typicalWakeWindow': 'typical wake window is about {duration}',

  // Sections
  'section.log': 'Log',
  'section.today': 'Today',
  'section.timeline': 'Timeline',
  'section.growth': 'Growth',
  'section.reminders': 'Reminders',

  // Actions
  'action.startSleep': 'Start sleep',
  'action.wakeUp': 'Wake up',
  'action.nursing': 'Nursing',
  'action.bottle': 'Bottle',
  'action.diaper.wet': 'Wet',
  'action.diaper.dirty': 'Dirty',
  'action.diaper.mixed': 'Mixed',
  'action.diaper.dry': 'Dry',
  'action.repeatFeed': 'Repeat last feed · {detail}',
  'action.previousDay': 'Previous day',
  'action.nextDay': 'Next day',
  'action.growth': 'Growth',
  'action.reminders': 'Reminders',
  'action.settings': 'Settings',
  'action.back': 'Back',
  'action.close': 'Close',

  // Daily summary
  'summary.feeds': 'Feeds',
  'summary.sleep': 'Sleep',
  'summary.diapers': 'Diapers',
  'summary.nursingTotal': '{duration} nursing',
  'summary.longestStretch': 'longest stretch {duration}',
  'summary.diapersWet.one': '{count} wet',
  'summary.diapersWet.other': '{count} wet',
  'summary.diapersDirty.one': '{count} dirty',
  'summary.diapersDirty.other': '{count} dirty',
  'summary.none': '—',

  // Timeline entries
  'event.nursed.left': 'Nursed left',
  'event.nursed.right': 'Nursed right',
  'event.bottle.breastMilk': 'Bottle, breast milk',
  'event.bottle.formula': 'Bottle, formula',
  'event.sleep.nap': 'Nap',
  'event.sleep.night': 'Night sleep',
  'event.diaper.wet': 'Wet diaper',
  'event.diaper.dirty': 'Dirty diaper',
  'event.diaper.mixed': 'Mixed diaper',
  'event.diaper.dry': 'Dry diaper',
  'event.growth.weight': 'Weight',
  'event.growth.length': 'Length',
  'event.growth.head': 'Head circumference',
  'event.sleepRunning': 'since {time} · {duration}',
  'event.sleepEnded': '{duration} · woke {time}',
  'event.live': 'now',
  'event.editHint': 'Edit this entry',
  'timeline.empty': 'Nothing logged yet on this day.',

  // Nursing sheet
  'nursing.title': 'Nursing',
  'nursing.side': 'Side',
  'nursing.side.left': 'Left',
  'nursing.side.right': 'Right',
  'nursing.side.lastUsed': '· last used',
  'nursing.suggestion': 'Last feed was on the {last}, so the {suggested} is suggested.',
  'nursing.running': 'Running · {side} side',
  'nursing.paused': 'Paused',
  'nursing.ready': 'Ready',
  'nursing.startedAt': 'Started {time}',
  'nursing.start': 'Start',
  'nursing.pause': 'Pause',
  'nursing.resume': 'Resume',
  'nursing.switchSide': 'Switch to {side} side',
  'nursing.discard': 'Discard',
  'nursing.save': 'Save feed',

  // Bottle sheet
  'bottle.title': 'Bottle',
  'bottle.contents': 'Contents',
  'bottle.contents.breastMilk': 'Breast milk',
  'bottle.contents.formula': 'Formula',
  'bottle.amount': 'Amount ({unit})',
  'bottle.exactAmount': 'Or enter an exact amount',
  'bottle.lastBottle': 'Last bottle was {amount}.',
  'bottle.save': 'Save bottle',
  'bottle.saving': 'Saving…',

  // Growth
  'growth.title': 'Growth',
  'growth.measure': 'Measurement',
  'growth.measure.weight': 'Weight',
  'growth.measure.length': 'Length',
  'growth.measure.head': 'Head',
  'growth.value': 'Value ({unit})',
  'growth.pounds': 'Pounds',
  'growth.ounces': 'Ounces',
  // Weight in imperial is spoken as two units, and the order is not universal.
  'growth.poundsOunces': '{pounds} lb {ounces} oz',
  'growth.save': 'Save measurement',
  'growth.add': 'Log a measurement',
  'growth.empty': 'No measurements yet.',
  'growth.emptyHint':
    'Weigh-ins from a check-up, or your own scale at home. Two readings are enough to see a trend.',
  'growth.latest': 'Latest',
  'growth.change': '{change} since {date}',
  'growth.perWeek': '{amount} per week',
  'growth.percentileLabel': 'Percentile',
  'growth.percentile': '{percentile} percentile for age',
  'growth.percentileBelowFirst': 'below the 1st percentile for age',
  'growth.percentileAboveLast': 'above the 99th percentile for age',
  'growth.percentileUnavailable': 'Percentile needs a birth date and sex in settings.',
  'growth.percentileNoData':
    'No WHO reference data for this measurement and age yet.',
  'growth.referenceNote':
    'Percentiles come from the WHO Child Growth Standards. They describe populations, not your baby — worth discussing with your doctor, never a diagnosis.',
  'growth.history': 'History',
  'growth.chart': 'Against the WHO reference',
  'growth.chartDescription':
    '{measure} plotted against the WHO {low}, {mid} and {high} percentile curves, from birth to {months} months.',
  'growth.chartNoReference':
    'No reference curves for this measurement, so only your own readings are plotted.',
  'growth.chartNeedsBirthDate':
    'Add a date of birth in settings to plot measurements against age.',
  'growth.axisAge': 'Age (months)',
  'growth.curveLabel': 'WHO {percentile}',
  'growth.measuredOn': 'Measured {date}',
  'growth.atAge': 'at {age}',

  // Reminders
  'reminders.title': 'Reminders',
  'reminders.empty': 'No reminders set.',
  'reminders.emptyHint':
    'A reminder counts from the last time you logged the thing — so feeding the baby is how you dismiss the feed reminder. Nothing to tap.',
  'reminders.add': 'Add a reminder',
  'reminders.edit': 'Edit reminder',
  'reminders.kind': 'Remind me about',
  'reminders.kind.feed': 'Next feed',
  'reminders.kind.diaper': 'Diaper change',
  'reminders.kind.pumping': 'Pumping',
  'reminders.kind.custom': 'Something else',
  'reminders.label': 'Name',
  'reminders.labelPlaceholder': 'e.g. Vitamin D drops',
  'reminders.interval': 'Every',
  'reminders.save': 'Save reminder',
  'reminders.delete': 'Delete reminder',
  'reminders.enabled': 'On',
  'reminders.due': 'Due now',
  'reminders.overdue': '{duration} overdue',
  'reminders.upcoming': 'in {duration}',
  'reminders.snoozedFor': 'snoozed · {duration}',
  'reminders.off': 'Off',
  'reminders.snooze': 'Snooze',
  'reminders.done': 'Done',
  'reminders.notifications': 'Notifications',
  'reminders.notificationsAsk': 'Allow notifications',
  'reminders.notificationsGranted': 'Notifications are on for this device.',
  'reminders.notificationsDenied':
    'Notifications are blocked in your browser settings. Reminders still appear on this screen and on the home screen.',
  'reminders.notificationsUnsupported':
    'This browser cannot show notifications. Reminders still appear on this screen and on the home screen.',
  'reminders.limitation':
    'Reminders alert while the app is open, including in the background once it is installed. There is no server here, so nothing can wake a fully closed app — anything that fell due while you were away is shown as overdue when you come back.',

  // Edit sheet
  'edit.title': 'Edit entry',
  'edit.date': 'Date',
  'edit.time': 'Time',
  'edit.duration': 'Length (minutes)',
  'edit.kind': 'Kind',
  'edit.wokeDate': 'Woke — date',
  'edit.wokeTime': 'Woke — time',
  'edit.stillRunning': 'Leave the wake-up time blank to keep this sleep running.',
  'edit.note': 'Note',
  'edit.notePlaceholder': 'Anything worth remembering',
  'edit.save': 'Save changes',
  'edit.saving': 'Saving…',
  'edit.delete': 'Delete entry',
  'edit.keep': 'Keep it',
  'edit.confirmDelete': 'Delete for good',

  // Settings
  'settings.title': 'Settings',
  'settings.baby': 'Baby',
  'settings.name': 'Name',
  'settings.birthDate': 'Date of birth',
  'settings.sex': 'Sex',
  'settings.sex.unset': 'Not set',
  'settings.sex.male': 'Boy',
  'settings.sex.female': 'Girl',
  'settings.sexNote':
    'Only used to pick the right WHO growth reference. Leave it unset if you would rather not record it.',
  'settings.saveDetails': 'Save details',
  'settings.display': 'Display',
  'settings.volumeUnit': 'Volume unit',
  'settings.volumeUnit.ml': 'Millilitres',
  'settings.volumeUnit.oz': 'Ounces',
  'settings.measureUnit': 'Weight and length',
  'settings.measureUnit.metric': 'Metric',
  'settings.measureUnit.imperial': 'Imperial',
  'settings.language': 'Language',
  'settings.languageNeedsReview':
    'This translation has not been reviewed by a native speaker yet. Corrections are very welcome.',
  'settings.theme': 'Theme',
  'settings.theme.auto': 'Auto',
  'settings.theme.day': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.night': 'Night',
  'settings.themeNote':
    'On auto, the app switches to a dim red-tinted night theme during your night hours, and follows your system light or dark setting the rest of the time.',
  'settings.nightStarts': 'Night starts',
  'settings.nightEnds': 'Night ends',
  'settings.nightNote':
    'These hours also decide whether a new sleep is logged as a nap or as night sleep.',
  'settings.wakeGuidance': 'Show wake-window guidance',
  'settings.wakeGuidanceNote':
    'Typical wake windows by age, shown for information only. Babies vary enormously — this is never advice.',
  'settings.data': 'Your data',
  'settings.dataNote':
    'Everything is stored on this device only. There is no account, no server and no analytics. Exports are yours to keep.',
  'settings.exportJson': 'Export JSON',
  'settings.exportCsv': 'Export CSV',
  'settings.exportNote':
    'JSON is a complete backup you can import again. CSV opens in any spreadsheet — useful to print for a doctor’s appointment.',
  'settings.import': 'Import a JSON backup',
  'settings.deleteAll': 'Delete all my data',
  'settings.deleteWarning':
    'This permanently deletes every baby and every entry on this device. If you have not exported a backup, it cannot be undone.',
  'settings.cancel': 'Cancel',
  'settings.confirmDeleteAll': 'Delete everything',
  'settings.about': 'About',
  'settings.aboutNote':
    'Baby Tracker is free and open source, licensed under the AGPL-3.0. Built for parents, by parents — contributions welcome.',
  'settings.medicalNote':
    'This app records what you tell it and shows you your own data. It does not diagnose anything and is no substitute for your paediatrician. If you are worried about your baby, call a doctor.',
  'settings.notMedical': 'Not a medical device.',
  'settings.sourceCode': 'Source code and issues',
  'settings.footer': 'Baby Tracker v{version} · works offline · no telemetry',

  // Toasts and messages
  'toast.diaperLogged.wet': 'Wet diaper logged',
  'toast.diaperLogged.dirty': 'Dirty diaper logged',
  'toast.diaperLogged.mixed': 'Mixed diaper logged',
  'toast.diaperLogged.dry': 'Dry diaper logged',
  'toast.sleepStarted': 'Sleep started',
  'toast.sleepEnded': 'Sleep ended',
  'toast.feedSaved': 'Feed saved',
  'toast.sideSaved': '{side} side saved',
  'toast.bottleSaved': 'Bottle saved',
  'toast.growthSaved': 'Measurement saved',
  'toast.reminderSaved': 'Reminder saved',
  'toast.reminderDeleted': 'Reminder deleted',
  'toast.reminderSnoozed': 'Snoozed for {duration}',
  'toast.reminderDone': 'Done · next in {duration}',
  'toast.feedRepeated': 'Last feed repeated',
  'toast.entryUpdated': 'Entry updated',
  'toast.entryDeleted': 'Entry deleted',
  'toast.detailsSaved': 'Details saved.',
  'toast.exportedJson': 'Exported a full JSON backup.',
  'toast.exportedCsv': 'Exported a CSV for spreadsheets and doctor visits.',
  'toast.dataDeleted': 'All data deleted from this device.',
  'toast.imported':
    'Imported {events} entries for {babies} babies.{skipped}',
  'toast.importedSkipped': ' Skipped {count} unreadable records.',

  // Errors
  'error.nameRequired': 'A name is required.',
  'error.enterAmount': 'Enter how much was in the bottle.',
  'error.enterValue': 'Enter a measurement.',
  'error.enterLabel': 'Give the reminder a name.',
  'error.enterDuration': 'Enter the length of the feed in minutes.',
  'error.invalidStart': 'That start time is not valid.',
  'error.invalidWake': 'That wake-up time is not valid.',
  'error.wakeBeforeStart': 'The wake-up time is before the sleep started.',
  'error.couldNotSave': 'Could not save',
  'error.exportFailed': 'Export failed',
  'error.importFailed': 'That file could not be imported',
  'error.couldNotDelete': 'Could not delete',
  'error.generic': 'Something went wrong',
  'error.storageBlocked': 'Could not open your data on this device.',
  'error.storageBlockedNote':
    'This usually means the browser is blocking local storage — private browsing mode is the most common cause. Your data has not been lost.',
  'error.tryAgain': 'Try again',

  // Age
  'age.bornToday': 'born today',
  'age.days.one': '{count} day old',
  'age.days.other': '{count} days old',
  'age.weeks.one': '{count} week old',
  'age.weeks.other': '{count} weeks old',
  'age.months.one': '{count} month old',
  'age.months.other': '{count} months old',
  'age.years.one': '{count} year old',
  'age.years.other': '{count} years old',
  'age.yearsMonths': '{years}y {months}m old',

  // Ordinals, for percentiles. English needs four forms (1st, 2nd, 3rd, 4th);
  // Intl.PluralRules picks between them with `type: 'ordinal'`. A language that
  // does not inflect ordinals sets all four to the same pattern.
  'ordinal.one': '{value}st',
  'ordinal.two': '{value}nd',
  'ordinal.few': '{value}rd',
  'ordinal.other': '{value}th',

  // Durations. Kept as patterns so a locale can reorder or re-space them.
  'duration.seconds': '{seconds}s',
  'duration.minutes': '{minutes}m',
  'duration.hours': '{hours}h',
  'duration.hoursMinutes': '{hours}h {minutes}m',
  'duration.justNow': 'just now',
  'duration.ago': '{duration} ago',
} as const

export type MessageKey = keyof typeof en
