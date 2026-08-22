import { describe, expect, it } from 'vitest'
import { MAX_PHOTO_EDGE, photoBytes, photoSource, scaledSize } from './photo'

describe('scaledSize', () => {
  it('leaves an already-small photo alone', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('caps the longest edge and keeps the aspect ratio', () => {
    // A 12-megapixel phone photo, which is what the picker actually hands over.
    expect(scaledSize(4032, 3024)).toEqual({ width: 1600, height: 1200 })
  })

  it('caps a portrait photo by its height', () => {
    expect(scaledSize(3024, 4032)).toEqual({ width: 1200, height: 1600 })
  })

  it('keeps a photo exactly at the limit unchanged', () => {
    expect(scaledSize(MAX_PHOTO_EDGE, 900)).toEqual({
      width: MAX_PHOTO_EDGE,
      height: 900,
    })
  })

  it('never rounds a short edge to zero', () => {
    // A panorama: 20000x200 scaled by 0.08 would round the height to 16, but a
    // more extreme ratio rounds to 0 and a zero-height canvas throws.
    const size = scaledSize(200000, 100)
    expect(size.height).toBeGreaterThanOrEqual(1)
    expect(size.width).toBe(MAX_PHOTO_EDGE)
  })

  it('does not divide by zero on an empty image', () => {
    expect(scaledSize(0, 0)).toEqual({ width: 0, height: 0 })
  })

  it('honours a smaller cap when asked', () => {
    expect(scaledSize(4000, 2000, 400)).toEqual({ width: 400, height: 200 })
  })
})

describe('photoSource', () => {
  it('builds a data URL the browser will accept', () => {
    expect(photoSource({ type: 'image/jpeg', data: 'AAAA' })).toBe(
      'data:image/jpeg;base64,AAAA',
    )
  })
})

describe('photoBytes', () => {
  it('undoes the base64 inflation to give the real size', () => {
    // 4 base64 characters carry 3 bytes.
    expect(photoBytes({ data: 'A'.repeat(4000) })).toBe(3000)
  })
})
