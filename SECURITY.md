# Security Policy

## Supported versions

This project is pre-1.0 and moves quickly. Only the latest release on `main`
receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub:

1. Go to the repository's **Security** tab
2. Choose **Report a vulnerability**
   ([direct link](https://github.com/beingmechon/baby-tracker/security/advisories/new))

That opens a private advisory only the maintainers can read.

Please include what you found, how to reproduce it, and what an attacker could
achieve. If you have a suggested fix, even better — but a clear report on its own
is genuinely valuable.

You can expect an acknowledgement within a few days. Because this is a volunteer
project run by people with small children, please be patient beyond that; we will
keep you informed as the fix progresses, and we will credit you in the release
notes unless you would rather stay anonymous.

## What is in scope

The app is a client-side PWA with no backend, which shapes the threat model. We are
particularly interested in:

- **Any unexpected network request.** The app should make none beyond loading its
  own assets. A request to a third party would be a serious finding.
- **Cross-site scripting**, especially via user-entered notes, imported files, or
  anything rendered from stored data.
- **Data leaking between origins**, or into a URL, `localStorage` key, or any
  place another site could read.
- **Import handling.** A malicious JSON export must not be able to corrupt the
  store, execute anything, or escalate beyond the app's own data.
- **CSV export injection.** Exports are meant to be opened in spreadsheets and
  handed to doctors, so a note must not be able to execute as a formula. Fields
  starting with `=`, `+`, `-` or `@` are guarded; a bypass is a valid report.
- **Service-worker or cache poisoning** that could persist malicious code across
  sessions.
- **Anything that destroys a user's data** without them asking, which for this app
  is as serious as a disclosure bug: for most users the device is the only copy.

## What is out of scope

- **Physical access to an unlocked device.** All data is stored locally and
  unencrypted by design; anyone holding your unlocked phone can read it, exactly
  as they could read your photos. Use your device's lock screen.
- **Loss of data from clearing browser storage.** This is documented behaviour,
  which is why the app offers exports. Reports about it are welcome as
  documentation or UX issues, not as vulnerabilities.
- Missing hardening headers on a deployment you control yourself.
- Findings from automated scanners with no demonstrated impact.
- Denial of service against your own local database.

## A note on data in reports

Never include real data about a child in a report, public or private. If
reproducing an issue seems to require your export file, say so and we will work
out how to narrow it down to a synthetic case instead.
