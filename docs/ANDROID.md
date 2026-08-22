# The Android app

The app you install from F-Droid is the same web app in a thin native shell. There
is no second codebase, no separate native UI, and no feature that exists only on
one platform — with exactly one exception, which is the reason the shell exists at
all.

## Why a shell at all

Reminders.

A web page can raise a notification while it is running. Nothing in a browser can
wake an app the user closed two hours ago: web push needs a server holding a
subscription endpoint, and the one API that would have solved it without a server —
Notification Triggers — was withdrawn before it shipped. For most apps that is a
shrug. For an app whose whole job is "feed at 2am", it is the feature.

The shell hands the due times to Android's own alarm scheduler, which fires them
whether the app is open, backgrounded, or dead. Nothing is sent anywhere to make
that work: the alarm is held by the phone.

Everything else already worked in a browser, and still does.

## No iOS

Deliberately. Building an iOS app requires a Mac and a paid Apple Developer
account, renewed yearly. An open-source project should not need either to ship, and
a contributor without a Mac should not be locked out of half the codebase.

On iOS the installed PWA is the answer: add it to the home screen and it works
offline, keeps its storage, and gets notifications while it is running. What it
cannot do is wake when fully closed — the same limitation the web has everywhere,
stated honestly on the reminders screen rather than papered over.

## What the shell costs the web build

Nothing, and this is enforced rather than hoped for.

`src/app/native.ts` imports nothing from Capacitor statically. It detects the
platform from the global the shell injects and reaches the plugin through a dynamic
`import()`, so the bridge lands in its own `native-*.js` chunk that a browser never
requests. `vite.config.ts` keeps that chunk out of the service-worker precache, and
`scripts/check-web-payload.mjs` asserts all of it against the real `dist/` on every
CI run — the chunk must be absent from the entry's static imports, absent from
index.html's preloads, absent from the precache, and *still present and reachable*,
so the check cannot pass by the feature having been deleted.

That script exists because the first attempt got it backwards: grouping the bridge
with `manualChunks` made Rollup treat it as a static dependency, so browsers
preloaded an Android bridge they could never run — and because it had also been
excluded from the precache, the app stopped loading offline. The build succeeded and
the bundle report looked *smaller*. Only the offline smoke test caught it.

## Getting an APK without installing anything

Every push builds one. Open the run under
[Actions](https://github.com/beingmechon/baby-tracker/actions), download the
`baby-tracker-debug-apk` artifact, and install the `.apk` on a phone with
"install unknown apps" enabled for your browser or file manager.

It is a *debug* build, signed with Android's public debug key. That is on purpose: a
release build needs a signing key, and a signing key committed to a public
repository is a key anyone can publish updates with.

## Building locally

You need a JDK (21 works) and the Android SDK. Then:

```bash
npm ci
npm run android:apk
```

The APK lands in `android/app/build/outputs/apk/debug/`. Install it over USB with
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run android:apk` runs three steps you can also run separately:

| Script | What it does |
| --- | --- |
| `npm run build` | Builds the web app into `dist/` |
| `npm run android:version` | Writes `versionName`/`versionCode` from package.json |
| `npx cap sync android` | Copies `dist/` in and refreshes the plugin list |

`cap sync` rather than `cap copy`: sync also refreshes the native plugin list, so
adding a Capacitor plugin cannot silently fail to reach the Android project.

## Versioning

`android/app/build.gradle` is generated from `package.json`, never edited by hand.
`versionCode` is derived arithmetically — `major·10000 + minor·100 + patch`, so
0.1.1 is 101 — because it has to increase monotonically and a hand-incremented
integer in a second file is a number that eventually disagrees with the first. CI
runs `npm run android:version` and rejects any diff, the same guard the icons and
the vendored fonts already have.

## Permissions, and why each one is there

| Permission | Why |
| --- | --- |
| `INTERNET` | Required by the WebView host. Nothing is fetched: the app serves its own bundled files over an `https://` scheme so the WebView stays a secure context, which is what IndexedDB and the clipboard need. There is no code in the app that can reach the network. |
| `POST_NOTIFICATIONS` | Reminders. Requested from a button the user pressed, never on launch. Android asks once: if it is refused, the app cannot ask again, so the screen stops offering a button that would do nothing and points at Settings → Apps → Baby Tracker → Notifications instead. |
| `RECEIVE_BOOT_COMPLETED` | Re-registers pending reminder alarms after a reboot, or they would silently vanish. |
| `WAKE_LOCK` | Lets a reminder fire while the phone is asleep, which is when it matters. |
| `SCHEDULE_EXACT_ALARM` | Lets a reminder land at the minute it is due rather than whenever Android next wakes up. User-grantable, and denying it makes reminders approximate rather than broken — the plugin falls back to an inexact alarm. |

`USE_EXACT_ALARM` — the variant granted automatically at install — is deliberately
**not** requested. It is reserved for alarm-clock and calendar apps. A feed reminder
is not an alarm clock, and taking that permission to avoid asking would be the wrong
trade.

## Signing a release build

For F-Droid you do not need to: F-Droid builds from source and signs with its own
key, which is the main reason it is the distribution channel here.

If you want to sign your own release build, generate a keystore, keep it out of git
(`android/.gitignore` refuses `*.jks`, `*.keystore`, `*.p12` and
`keystore.properties`), and pass it to Gradle through environment variables or a
local `keystore.properties`. Never commit it, and never paste it into an issue.

## F-Droid

Metadata lives in `metadata/io.github.beingmechon.babytracker/`, in the layout
F-Droid's `fdroiddata` expects. The app qualifies without compromise: AGPL-3.0,
no proprietary dependencies, no analytics, no ad network, no tracking, and no
network calls at all. Capacitor is MIT.
