import { describe, expect, it } from 'vitest'
import { MINUTE_MS } from '@/domain/time'
import { at, bottle, diaper, growth, nursing, sleep } from '@/test/factories'
import { translatorFor } from '@/i18n/locales'
import type { MeasureSystem, VolumeUnit } from '@/domain/types'
import { describeEvent } from './describeEvent'

const en = translatorFor('en')

const NOW = at(2026, 1, 15, 15, 0)

function ctx(volumeUnit: VolumeUnit, measureSystem: MeasureSystem = 'metric') {
  return { volumeUnit, measureSystem, now: NOW, t: en }
}

describe('describeEvent', () => {
  it('names the side for a nursing session', () => {
    const described = describeEvent(nursing(NOW, 15 * MINUTE_MS, 'right'), ctx('ml'))
    expect(described).toMatchObject({
      category: 'feed',
      title: 'Nursed right',
      detail: '15m',
      live: false,
    })
  })

  it('shows a bottle in the user’s chosen unit', () => {
    const event = bottle(NOW, 120, 'breast_milk')
    expect(describeEvent(event, ctx('ml')).detail).toBe('120 ml')
    expect(describeEvent(event, ctx('oz')).detail).toBe('4.1 oz')
  })

  it('distinguishes breast milk from formula', () => {
    expect(describeEvent(bottle(NOW, 120, 'breast_milk'), ctx('ml')).title).toBe(
      'Bottle, breast milk',
    )
    expect(describeEvent(bottle(NOW, 120, 'formula'), ctx('ml')).title).toBe(
      'Bottle, formula',
    )
  })

  it('labels a finished sleep with its length and wake time', () => {
    const nap = sleep(at(2026, 1, 15, 13, 0), at(2026, 1, 15, 14, 30), 'nap')
    expect(describeEvent(nap, ctx('ml'))).toMatchObject({
      category: 'sleep',
      title: 'Nap',
      detail: '1h 30m · woke 2:30 pm',
      live: false,
    })
  })

  it('marks a running sleep as live and counts up to now', () => {
    const running = sleep(at(2026, 1, 15, 14, 15), null, 'nap')
    expect(describeEvent(running, ctx('ml'))).toMatchObject({
      detail: 'since 2:15 pm · 45m',
      live: true,
    })
  })

  it('distinguishes night sleep from a nap', () => {
    const night = sleep(at(2026, 1, 15, 20, 0), at(2026, 1, 16, 5, 0), 'night')
    expect(describeEvent(night, ctx('ml')).title).toBe('Night sleep')
  })

  it('names each diaper kind and needs no detail line', () => {
    expect(describeEvent(diaper(NOW, 'wet'), ctx('ml'))).toMatchObject({
      category: 'diaper',
      title: 'Wet diaper',
      detail: '',
    })
    expect(describeEvent(diaper(NOW, 'mixed'), ctx('ml')).title).toBe('Mixed diaper')
  })

  it('shows a measurement in the reader own units', () => {
    const weight = growth(NOW, 'weight', 4500)
    expect(describeEvent(weight, ctx('ml'))).toMatchObject({
      category: 'growth',
      title: 'Weight',
      detail: '4.5 kg',
    })
    expect(describeEvent(weight, ctx('ml', 'imperial')).detail).toBe('9 lb 15 oz')
  })

  it('names each measurement kind', () => {
    expect(describeEvent(growth(NOW, 'length', 625), ctx('ml')).detail).toBe('62.5 cm')
    expect(describeEvent(growth(NOW, 'head', 412), ctx('ml')).title).toBe(
      'Head circumference',
    )
  })
})
