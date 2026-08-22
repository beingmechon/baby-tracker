// Storage tests need an IndexedDB implementation; Node has none.
import 'fake-indexeddb/auto'

/**
 * A minimal in-memory `localStorage`.
 *
 * The suite runs in the `node` environment rather than jsdom, which keeps it fast
 * but leaves `localStorage` undefined — so the two things that use it, the nursing
 * timer and the settings store, were silently untestable: their try/catch simply
 * swallowed the ReferenceError and returned a default. Twenty lines here is a
 * better trade than a DOM environment for the whole suite.
 */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value))
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
})
