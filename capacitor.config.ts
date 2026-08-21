import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android shell.
 *
 * Capacitor wraps the same `dist/` the web build produces — there is no separate
 * native codebase and no second implementation of anything. The shell exists for
 * exactly one capability the web cannot provide: an OS-scheduled notification that
 * fires when the app is closed. Everything else already worked.
 *
 * There is no iOS target, deliberately. Building one requires a Mac and a paid
 * Apple account, neither of which an open-source project should need in order to
 * ship. Android and F-Droid need neither.
 */
const config: CapacitorConfig = {
  // Reverse-DNS of the repository, which is the identifier F-Droid will build under.
  appId: 'io.github.beingmechon.babytracker',
  appName: 'Baby Tracker',
  webDir: 'dist',
  android: {
    // The shell is a viewport onto local files. Nothing here is fetched, so there
    // is nothing to allow: no cleartext, no external origins.
    allowMixedContent: false,
  },
  server: {
    // Serving over https:// rather than the http:// default keeps the WebView in a
    // secure context, which is what IndexedDB, service workers and the clipboard
    // all require. Getting this wrong silently downgrades storage.
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      // The one place a colour is named outside tokens.css: Android tints the
      // status-bar icon with it, and it has to be the ochre accent.
      iconColor: '#d6b081',
    },
  },
}

export default config
