/**
 * Opaque, collision-resistant ids generated on-device. UUIDs rather than
 * auto-increment integers because v0.3 will merge event streams from several
 * caregivers' devices, and independently generated ids must not collide.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Older WebViews lack randomUUID; getRandomValues is far more widely shipped.
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  throw new Error('No secure random source available for id generation')
}
