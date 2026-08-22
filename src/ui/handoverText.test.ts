import { describe, expect, it } from 'vitest'
import { handover } from '@/domain/handover'
import { HOUR_MS, MINUTE_MS } from '@/domain/time'
import type { BabyEvent } from '@/domain/types'
import { translatorFor } from '@/i18n/locales'
import {
  at,
  bottle,
  diaper,
  medication,
  nursing,
  sleep,
  temperature,
} from '@/test/factories'
import { handoverText } from './handoverText'

const t = translatorFor('en')
const NOW = at(2026, 1, 15, 18, 0)

function render(events: BabyEvent[], since = NOW - 4 * HOUR_MS): string {
  return handoverText(handover(events, since, NOW), {
    t,
    babyName: 'Mira',
    volumeUnit: 'ml',
    measureSystem: 'metric',
  })
}

describe('handoverText', () => {
  it('opens by naming the baby and the window', () => {
    const text = render([])
    expect(text.split('\n')[0]).toBe('Mira — 2:00 pm to 6:00 pm')
  })

  it('counts the window and then dates the last of each thing', () => {
    const text = render([
      nursing(at(2026, 1, 15, 15, 0), 20 * MINUTE_MS),
      bottle(at(2026, 1, 15, 17, 0), 90, 'formula'),
      diaper(at(2026, 1, 15, 16, 30), 'wet'),
      sleep(at(2026, 1, 15, 15, 30), at(2026, 1, 15, 16, 15), 'nap'),
    ])

    expect(text).toContain('2 feeds · 90 ml · 20m')
    expect(text).toContain('1 sleep · 45m')
    expect(text).toContain('1 diaper')
    expect(text).toContain('Woke at 4:15 pm')
    expect(text).toContain('Last fed at 5:00 pm')
    expect(text).toContain('Last diaper at 4:30 pm')
  })

  it('says the baby is asleep rather than when they woke', () => {
    const text = render([sleep(at(2026, 1, 15, 17, 30), null, 'nap')])
    expect(text).toContain('Asleep since 5:30 pm')
    expect(text).not.toContain('Woke at')
  })

  it('names the medicine, the dose and the time', () => {
    const text = render([medication(at(2026, 1, 15, 16, 0), 'Calpol', '2.5 ml')])
    expect(text).toContain('Calpol 2.5 ml at 4:00 pm')
  })

  it('does not print an empty dose as a gap in the sentence', () => {
    const text = render([medication(at(2026, 1, 15, 16, 0), 'Vitamin D')])
    expect(text).toContain('Vitamin D — at 4:00 pm')
    expect(text).not.toMatch(/Vitamin D {2}at/)
  })

  it('carries a temperature reading in the parent’s own units', () => {
    const events = [temperature(at(2026, 1, 15, 17, 0), 3760)]
    expect(render(events)).toContain('Temperature 37.6 °C at 5:00 pm')

    const fahrenheit = handoverText(handover(events, NOW - 4 * HOUR_MS, NOW), {
      t,
      babyName: 'Mira',
      volumeUnit: 'oz',
      measureSystem: 'imperial',
    })
    expect(fahrenheit).toContain('99.7 °F')
  })

  it('says so plainly when the window is empty', () => {
    expect(render([])).toContain('Nothing logged in this time.')
  })

  it('still gives the last feed when the window itself is empty', () => {
    // The point of the whole screen: "no feeds in four hours" is useless at the
    // door, "last fed at 09:15" is the same fact made useful.
    const text = render([nursing(at(2026, 1, 15, 9, 15), 20 * MINUTE_MS)])
    expect(text).toContain('Last fed at 9:15 am')
    // Both facts, not one instead of the other.
    expect(text).toContain('Nothing logged in this time.')
  })

  it('is plain text with no markup, emoji or trailing blank lines', () => {
    const text = render([
      nursing(at(2026, 1, 15, 15, 0), 20 * MINUTE_MS),
      diaper(at(2026, 1, 15, 16, 30), 'wet'),
    ])
    expect(text).not.toMatch(/[*_#`|]/)
    expect(text.endsWith('\n')).toBe(false)
    // One blank line separates the counts from the "right now" block, and that is
    // the only run of blank lines allowed — a message with gaps in it reads as
    // broken when pasted.
    expect(text).not.toMatch(/\n\n\n/)
  })

  it('reads in the language the app is in', () => {
    const spanish = handoverText(
      handover([diaper(at(2026, 1, 15, 16, 30), 'wet')], NOW - 4 * HOUR_MS, NOW),
      {
        t: translatorFor('es'),
        babyName: 'Mira',
        volumeUnit: 'ml',
        measureSystem: 'metric',
      },
    )
    expect(spanish).toContain('1 pañal')
    expect(spanish).toContain('Último pañal a las 16:30')
  })
})
