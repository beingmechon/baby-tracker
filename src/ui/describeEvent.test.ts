import { describe, expect, it } from 'vitest'
import { MINUTE_MS } from '@/domain/time'
import { at, bottle, diaper, nursing, sleep } from '@/test/factories'
import { translatorFor } from '@/i18n/locales'
import { describeEvent } from './describeEvent'

const en = translatorFor('en')

const NOW = at(2026, 1, 15, 15, 0)

describe('describeEvent', () => {
  it('names the side for a nursing session', () => {
    const described = describeEvent(nursing(NOW, 15 * MINUTE_MS, 'right'), 'ml', NOW, en)
    expect(described).toMatchObject({
      category: 'feed',
      title: 'Nursed right',
      detail: '15m',
      live: false,
    })
  })

  it('shows a bottle in the user’s chosen unit', () => {
    const event = bottle(NOW, 120, 'breast_milk')
    expect(describeEvent(event, 'ml', NOW, en).detail).toBe('120 ml')
    expect(describeEvent(event, 'oz', NOW, en).detail).toBe('4.1 oz')
  })

  it('distinguishes breast milk from formula', () => {
    expect(describeEvent(bottle(NOW, 120, 'breast_milk'), 'ml', NOW, en).title).toBe(
      'Bottle, breast milk',
    )
    expect(describeEvent(bottle(NOW, 120, 'formula'), 'ml', NOW, en).title).toBe(
      'Bottle, formula',
    )
  })

  it('labels a finished sleep with its length and wake time', () => {
    const nap = sleep(at(2026, 1, 15, 13, 0), at(2026, 1, 15, 14, 30), 'nap')
    expect(describeEvent(nap, 'ml', NOW, en)).toMatchObject({
      category: 'sleep',
      title: 'Nap',
      detail: '1h 30m · woke 2:30 pm',
      live: false,
    })
  })

  it('marks a running sleep as live and counts up to now', () => {
    const running = sleep(at(2026, 1, 15, 14, 15), null, 'nap')
    expect(describeEvent(running, 'ml', NOW, en)).toMatchObject({
      detail: 'since 2:15 pm · 45m',
      live: true,
    })
  })

  it('distinguishes night sleep from a nap', () => {
    const night = sleep(at(2026, 1, 15, 20, 0), at(2026, 1, 16, 5, 0), 'night')
    expect(describeEvent(night, 'ml', NOW, en).title).toBe('Night sleep')
  })

  it('names each diaper kind and needs no detail line', () => {
    expect(describeEvent(diaper(NOW, 'wet'), 'ml', NOW, en)).toMatchObject({
      category: 'diaper',
      title: 'Wet diaper',
      detail: '',
    })
    expect(describeEvent(diaper(NOW, 'mixed'), 'ml', NOW, en).title).toBe('Mixed diaper')
  })
})
