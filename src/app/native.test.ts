import { describe, expect, it } from 'vitest'
import { isNativeApp, mapNativePermission, nativePlatform } from './native'

describe('mapNativePermission', () => {
  it('passes granted and denied straight through', () => {
    expect(mapNativePermission('granted')).toBe('granted')
    expect(mapNativePermission('denied')).toBe('denied')
  })

  it('keeps a refusal distinguishable from never having asked', () => {
    // This is the whole point. Reporting a refusal as "not asked yet" left the
    // "Allow notifications" button on screen for a dialog Android will never show
    // again, so tapping it did nothing at all.
    expect(mapNativePermission('denied')).not.toBe(mapNativePermission('prompt'))
  })

  it('treats every askable state as askable', () => {
    expect(mapNativePermission('prompt')).toBe('default')
    // Android's "they said no once, you may explain yourself" — still askable.
    expect(mapNativePermission('prompt-with-rationale')).toBe('default')
  })

  it('treats an unknown state as askable rather than as a refusal', () => {
    // A future plugin version adding a state must not silently lock a parent out
    // of their reminders.
    expect(mapNativePermission('something-new')).toBe('default')
    expect(mapNativePermission('')).toBe('default')
  })
})

describe('platform detection off a device', () => {
  it('reports the web, so every native path is skipped', () => {
    expect(isNativeApp()).toBe(false)
    expect(nativePlatform()).toBe('web')
  })
})
