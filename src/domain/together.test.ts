import { describe, expect, it } from 'vitest'
import { cleanTogetherIds, fansOut, logTargets, logsTogether } from './together'

describe('logTargets', () => {
  it('is just the active baby when no group is set', () => {
    expect(logTargets('a', [])).toEqual(['a'])
  })

  it('is nothing at all when no baby is open', () => {
    expect(logTargets(null, ['a', 'b'])).toEqual([])
  })

  it('fans out to the group when the active baby is in it', () => {
    expect(logTargets('a', ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('puts the baby on screen first', () => {
    // A failure part-way through must not leave the sibling holding the only copy.
    expect(logTargets('b', ['a', 'b'])).toEqual(['b', 'a'])
  })

  it('leaves a baby outside the group alone', () => {
    // Twins plus an older child: the setting can stay on permanently.
    expect(logTargets('c', ['a', 'b'])).toEqual(['c'])
  })

  it('never writes the same baby twice', () => {
    expect(logTargets('a', ['a', 'a', 'b'])).toEqual(['a', 'b'])
  })

  it('handles a group of three, because triplets exist', () => {
    expect(logTargets('a', ['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })
})

describe('fansOut', () => {
  it('fans out the shared actions a parent takes once', () => {
    expect(fansOut('nursing')).toBe(true)
    expect(fansOut('bottle')).toBe(true)
    expect(fansOut('diaper')).toBe(true)
  })

  it('never fans out a record about one body', () => {
    // A duplicated dose would put a record in a second child's medical log saying
    // they received a drug they did not receive. That is the line.
    expect(fansOut('medication')).toBe(false)
    expect(fansOut('temperature')).toBe(false)
    expect(fansOut('symptom')).toBe(false)
    expect(fansOut('growth')).toBe(false)
    expect(fansOut('visit')).toBe(false)
  })

  it('never fans out sleep or pumping', () => {
    // Sleep is a running timer belonging to one baby, and twins do not wake at the
    // same minute. Pumping is the parent's output; copying it double-counts milk.
    expect(fansOut('sleep')).toBe(false)
    expect(fansOut('pumping')).toBe(false)
  })
})

describe('logTargets, by event type', () => {
  it('fans out a diaper but not a dose', () => {
    expect(logTargets('a', ['a', 'b'], 'diaper')).toEqual(['a', 'b'])
    expect(logTargets('a', ['a', 'b'], 'medication')).toEqual(['a'])
  })

  it('fans out everything when no type is given', () => {
    // The type is optional so a caller that genuinely means "the whole group" —
    // the settings screen describing itself — does not have to name an event.
    expect(logTargets('a', ['a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('logsTogether', () => {
  it('is true only when an event will actually reach a second baby', () => {
    expect(logsTogether('a', ['a', 'b'])).toBe(true)
    expect(logsTogether('c', ['a', 'b'])).toBe(false)
    expect(logsTogether('a', ['a'])).toBe(false)
    expect(logsTogether('a', [])).toBe(false)
    expect(logsTogether(null, ['a', 'b'])).toBe(false)
  })
})

describe('cleanTogetherIds', () => {
  it('drops a baby who no longer exists', () => {
    // Settings live in localStorage and know nothing about a deleted baby.
    expect(cleanTogetherIds(['a', 'gone', 'b'], ['a', 'b', 'c'])).toEqual(['a', 'b'])
  })

  it('treats a group of one as no group', () => {
    expect(cleanTogetherIds(['a', 'gone'], ['a'])).toEqual([])
    expect(cleanTogetherIds(['a'], ['a'])).toEqual([])
  })

  it('removes duplicates', () => {
    expect(cleanTogetherIds(['a', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('keeps a group of three', () => {
    expect(cleanTogetherIds(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('has nothing to clean when there is no group', () => {
    expect(cleanTogetherIds([], ['a', 'b'])).toEqual([])
  })
})
