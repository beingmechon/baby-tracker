import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
// vitest's defineConfig is vite's, widened to accept the `test` block.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The app is deployed to a project subpath on GitHub Pages, but runs from the
// root during local development. BASE_PATH lets CI override it.
const base = process.env.BASE_PATH ?? '/'

const { version } = createRequire(import.meta.url)('./package.json') as {
  version: string
}

/**
 * The Android bridge is split into a chunk with a predictable name.
 *
 * Two things depend on the name being stable rather than hashed into anonymity:
 * the service worker excludes it from the precache below, and this comment can
 * point at it. Without that, a browser downloads an Android bridge it will never
 * execute — 13 kB of nothing, on the cold first load this project optimises for.
 */
const NATIVE_CHUNK = 'native'

export default defineConfig({
  base,
  // Keeps the version shown in Settings tied to package.json rather than a
  // second copy that quietly goes stale.
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Renames the chunks that contain Capacitor; deliberately does NOT use
        // `manualChunks` to group them. Forcing them into a named chunk made
        // Rollup treat that chunk as a static dependency of the entry, so the
        // browser preloaded the Android bridge instead of never fetching it — and
        // because the precache excludes it, offline reload broke outright. Naming
        // leaves the module graph exactly as it was: reachable only through the
        // dynamic `import()` in `app/native.ts`.
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some((id) => id.includes('@capacitor/'))
            ? `assets/${NATIVE_CHUNK}-[hash].js`
            : 'assets/[name]-[hash].js',
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Everything the app needs is precached, so a cold start with no
        // network is identical to a warm one. This is the whole point.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The Android bridge is dead weight in a browser: it is reached only
        // through a dynamic import guarded by a native-platform check, so a web
        // visitor would precache it and never run it. The shell loads it from its
        // own local assets and needs no cache entry either.
        globIgnores: [`**/${NATIVE_CHUNK}-*.js`],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Baby Tracker',
        short_name: 'Baby',
        description:
          'A private, offline-first baby tracker. Feeds, sleep and diapers in one tap.',
        theme_color: '#1b2a4a',
        background_color: '#1b2a4a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        categories: ['health', 'lifestyle', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
