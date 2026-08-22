import { describe, expect, it } from 'vitest'
import { at } from '@/test/factories'
import {
  LOW_THRESHOLD,
  RAISED_THRESHOLD,
  YOUNG_INFANT_DAYS,
  celsiusToFahrenheit,
  describeTemperature,
  fahrenheitToCelsius,
  fromHundredths,
  isValidTemperature,
  latestTemperature,
  medicationNames,
  medicationSummaries,
  toHundredths,
} from './health'
import type { BabyEvent, MedicationEvent, TemperatureEvent } from './types'

let counter = 0

function temperature(
  startedAt: number,
  celsiusHundredths: number,
  site: TemperatureEvent['site'] = 'armpit',
): TemperatureEvent {
  counter += 1
  return {
    id: `temp-${counter}`,
    babyId: 'baby-1',
    type: 'temperature',
    startedAt,
    celsiusHundredths,
    site,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

function medication(startedAt: number, name: string, dose: string): MedicationEvent {
  counter += 1
  return {
    id: `med-${counter}`,
    babyId: 'baby-1',
    type: 'medication',
    startedAt,
    name,
    dose,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

describe('temperature conversion', () => {
  it('uses the real formula, not an approximation', () => {
    expect(celsiusToFahrenheit(0)).toBe(32)
    expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 6)
    expect(celsiusToFahrenheit(100)).toBe(212)
    expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 6)
  })

  it('round-trips a reading typed in Fahrenheit', () => {
    // The reason storage is hundredths of a degree: a parent who types 99.7 and
    // reads it back must see 99.7, not 99.6 or 99.8.
    for (const reading of [97.5, 98.6, 99.7, 100.4, 103.1]) {
      const stored = toHundredths(reading, 'f')
      expect(fromHundredths(stored, 'f')).toBeCloseTo(reading, 1)
    }
  })

  it('round-trips a reading typed in Celsius', () => {
    for (const reading of [36.4, 37, 37.5, 38.2, 39.9]) {
      expect(fromHundredths(toHundredths(reading, 'c'), 'c')).toBeCloseTo(reading, 1)
    }
  })

  it('stores whole hundredths, so no float dust reaches the database', () => {
    const stored = toHundredths(100.4, 'f')
    expect(Number.isInteger(stored)).toBe(true)
    expect(stored).toBe(3800)
  })
})

describe('describeTemperature', () => {
  const NOW = at(2026, 3, 1, 12, 0)

  it('calls 38.0 °C raised, and 37.9 normal', () => {
    expect(describeTemperature(temperature(NOW, 3800), null).band).toBe('raised')
    expect(describeTemperature(temperature(NOW, 3790), null).band).toBe('normal')
  })

  it('flags a low reading', () => {
    expect(describeTemperature(temperature(NOW, 3590), null).band).toBe('low')
    expect(describeTemperature(temperature(NOW, 3600), null).band).toBe('normal')
  })

  it('uses the thresholds the copy quotes', () => {
    expect(RAISED_THRESHOLD).toBe(3800)
    expect(LOW_THRESHOLD).toBe(3600)
    expect(YOUNG_INFANT_DAYS).toBe(90)
  })

  it('singles out a raised reading in a baby under three months', () => {
    // Every health service treats this case differently, so the app says what the
    // guidance says. Not saying it would be the more harmful choice.
    const reading = describeTemperature(temperature(NOW, 3850), '2026-02-01')
    expect(reading.youngInfant).toBe(true)
  })

  it('does not flag a normal reading in a young baby', () => {
    expect(describeTemperature(temperature(NOW, 3700), '2026-02-01').youngInfant).toBe(
      false,
    )
  })

  it('does not flag an older baby', () => {
    expect(describeTemperature(temperature(NOW, 3900), '2025-06-01').youngInfant).toBe(
      false,
    )
  })

  it('judges age at the reading, not age today', () => {
    // A fever recorded at six weeks does not stop having been a six-week-old's
    // fever once the baby is four months old.
    const sixWeeks = at(2026, 3, 15, 9, 0)
    const reading = describeTemperature(temperature(sixWeeks, 3850), '2026-02-01')
    expect(reading.youngInfant).toBe(true)
  })

  it('cannot flag anything without a birth date', () => {
    expect(describeTemperature(temperature(NOW, 3900), null).youngInfant).toBe(false)
  })
})

describe('isValidTemperature', () => {
  it('accepts plausible body temperatures', () => {
    expect(isValidTemperature(3650)).toBe(true)
    expect(isValidTemperature(4100)).toBe(true)
  })

  it('rejects a reading no thermometer would give', () => {
    // A typo or a broken thermometer, and storing it would put nonsense in front
    // of a doctor.
    expect(isValidTemperature(0)).toBe(false)
    expect(isValidTemperature(2000)).toBe(false)
    expect(isValidTemperature(5000)).toBe(false)
    expect(isValidTemperature(NaN)).toBe(false)
  })
})

describe('latestTemperature', () => {
  it('finds the most recent reading and ignores everything else', () => {
    const events: BabyEvent[] = [
      temperature(at(2026, 3, 1, 9, 0), 3700),
      temperature(at(2026, 3, 1, 15, 0), 3850),
      medication(at(2026, 3, 1, 18, 0), 'Paracetamol', '2.5 ml'),
    ]
    expect(latestTemperature(events)?.celsiusHundredths).toBe(3850)
    expect(latestTemperature([])).toBeNull()
  })
})

describe('medicationSummaries', () => {
  it('groups doses by name, most recently given first', () => {
    const events: BabyEvent[] = [
      medication(at(2026, 3, 1, 8, 0), 'Paracetamol', '2.5 ml'),
      medication(at(2026, 3, 1, 9, 0), 'Vitamin D', '1 drop'),
      medication(at(2026, 3, 1, 14, 0), 'Paracetamol', '2.5 ml'),
    ]
    const summaries = medicationSummaries(events)
    expect(summaries.map((entry) => entry.name)).toEqual(['Paracetamol', 'Vitamin D'])
    expect(summaries[0]).toMatchObject({
      lastGivenAt: at(2026, 3, 1, 14, 0),
      timesGiven: 2,
    })
  })

  it('treats different spellings of the same bottle as one medicine', () => {
    // "last given" is the question this answers, and two spellings would answer it
    // wrongly — the exact case where a parent gives a second dose too early.
    const events: BabyEvent[] = [
      medication(at(2026, 3, 1, 8, 0), 'Calpol', '2.5 ml'),
      medication(at(2026, 3, 1, 14, 0), '  calpol ', '5 ml'),
    ]
    const summaries = medicationSummaries(events)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({ timesGiven: 2, lastDose: '5 ml' })
    // The display name follows the most recent spelling, so fixing it once fixes it.
    expect(summaries[0]!.name).toBe('calpol')
  })

  it('reports the dose from the latest entry, not the first', () => {
    const events: BabyEvent[] = [
      medication(at(2026, 3, 1, 14, 0), 'Ibuprofen', '5 ml'),
      medication(at(2026, 3, 1, 8, 0), 'Ibuprofen', '2.5 ml'),
    ]
    expect(medicationSummaries(events)[0]).toMatchObject({
      lastDose: '5 ml',
      lastGivenAt: at(2026, 3, 1, 14, 0),
    })
  })

  it('ignores an entry with a blank name', () => {
    expect(medicationSummaries([medication(at(2026, 3, 1), '   ', '5 ml')])).toEqual([])
  })

  it('lists the names for suggesting the next dose', () => {
    const events: BabyEvent[] = [
      medication(at(2026, 3, 1, 8, 0), 'Paracetamol', '2.5 ml'),
      medication(at(2026, 3, 1, 9, 0), 'Vitamin D', '1 drop'),
    ]
    expect(medicationNames(events)).toEqual(['Vitamin D', 'Paracetamol'])
  })
})
