# Privacy

The short version: **your data stays on your device, and we never see it.**

This is not a policy written to cover us legally. It is a description of how the
app is built, and every claim below can be checked against the source.

## What we collect

Nothing.

There is no account, no sign-up, no email address, no device identifier, no
analytics, no crash reporting, no advertising network, no third-party scripts, and
no server that belongs to this project. We could not tell you how many people use
this app, and that is deliberate.

## Where your data lives

Everything you log — your baby's name, birth date, feeds, sleeps, diapers, notes —
is stored in **IndexedDB in your own browser**, on your own device. It is written
by the app and read by the app. Nothing sends it anywhere.

Your settings (units, theme, night hours) live in `localStorage` on the same
device.

## Network activity

The app makes exactly one kind of network request: downloading its own code and
icons the first time you visit, and occasionally checking for an update.

**The Android app makes none at all.** Its files are already on the device, served
from local storage. It holds the `INTERNET` permission only because the WebView it
runs in requires it to serve those local files over an `https://` scheme — which is
what IndexedDB and the clipboard need in order to work. There is no code in the app
that can reach the network, which is what makes this checkable rather than a promise.

Reminders on Android are handed to the operating system's alarm scheduler. That is a
call into your own phone, not out of it: no subscription endpoint, no push service,
nothing registered with Google or with us. It is the reason the Android app exists —
a browser cannot wake an app you closed, and only a server could make it, so we
built the shell instead of the server.

After the first load it works entirely offline. If you install it to your home screen and
turn off your connection, it still opens and still logs — this is verified by an
automated test on every change, not just claimed here.

There is no request, at any point, that carries anything you logged.

## What this means in practice

Local-only storage is a genuine trade-off, and you should know both halves of it.

**What you get:** nobody can sell your data, mine it, breach it, subpoena it from
us, or change the terms later and start monetising it. There is nothing to breach.

**What you take on:** you are the backup. Specifically —

- **Clearing your browser's site data deletes everything.** So does "clear
  browsing data" if you include site data, and some privacy extensions or
  cleanup tools do it automatically.
- Uninstalling the app from your home screen may remove its storage.
- Your data does not follow you to a new phone by itself.
- Some browsers may evict storage from sites you have not visited in a long time.
  Installing the app to your home screen makes that much less likely.

**So export a backup now and then.** Settings → Export JSON gives you a complete
file you can restore later or move to another device. It takes one tap.

## Your controls

- **Export JSON** — a complete backup, restorable through Import.
- **Export CSV** — a spreadsheet-friendly version, useful to print for a
  paediatrician.
- **Import JSON** — restore a backup, or move to a new device.
- **Delete all my data** — erases every baby and every entry from this device
  immediately. There is no copy anywhere else, so this cannot be undone.

## Sharing an export

An export contains everything about your child. Once you share the file, this
app's privacy guarantees no longer apply to it. Treat it like a medical record:
be deliberate about email, cloud drives and messaging apps.

CSV exports are deliberately hardened against spreadsheet formula injection, so a
file you hand to a doctor cannot execute anything when opened.

The same applies to the handover screen. "Copy as a message" puts plain text on
your clipboard and nothing else happens — no request is made, and the app does not
know or care where you paste it. Once it is in a message or on a nursery's
whiteboard, it is out of this app's hands. "Print or save as PDF" opens your own
device's print dialog; the app never sees the result.

## Children's data

The whole app is about a child, and the data is unusually sensitive. This is
precisely why it never leaves your device. Because there is no server and no
account, there is no collection of children's data to consent to, restrict, or
request deletion of — you already hold all of it, and you can delete it yourself in
one tap.

## Future sync (not yet built)

The roadmap includes optional sync for households with more than one caregiver. It
is not implemented, and when it is:

- It will be **off by default** and entirely optional.
- You will choose between **no sync**, a **server you host yourself**, or an
  **end-to-end encrypted relay** that cannot read your data.
- Local-only will remain fully supported, permanently.

Sync will never become a requirement for a feature, and there will never be a
version of this app that needs an account.

## Changes

If this document ever changes materially, the change will be in the git history and
in the release notes. Since we hold no data, there is no back catalogue of yours
that a change could retroactively affect.

## Questions

Open an issue. If your question involves your own data, do not paste it — describe
the situation instead.
