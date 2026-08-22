import { useEffect, useMemo, useRef, useState } from 'react'
import type { StoredPhoto } from '@/data/repository'
import type { BabyStore } from '@/app/useBabyStore'
import {
  MILESTONE_SUGGESTIONS,
  milestoneEvents,
  photoMilestones,
  remainingSuggestions,
} from '@/domain/milestones'
import { describeAge } from '@/domain/time'
import type { Id, MilestoneEvent } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { formatAge, formatShortDate } from '@/i18n/format'
import { RuleLabel } from './RuleLabel'
import { Sheet } from './Sheet'
import { BackIcon, CheckIcon, CloseIcon } from './icons'
import { photoBytes, photoSource, preparePhoto, type PreparedPhoto } from './photo'

interface MilestonesScreenProps {
  store: BabyStore
  onBack: () => void
}

/**
 * A thumbnail, loaded from the photo store on demand.
 *
 * Photos are fetched per-tile rather than all at once with the events: a year of
 * keepsakes is tens of megabytes, and holding all of it in React state to render a
 * grid of 96-pixel squares is how a phone runs out of memory.
 */
function PhotoTile({
  readPhoto,
  photoId,
  alt,
}: {
  /** The stable reader from the store, not the store object — see below. */
  readPhoto: BabyStore['readPhoto']
  photoId: Id
  alt: string
}) {
  const [photo, setPhoto] = useState<StoredPhoto | null>(null)

  // Keyed on the reader rather than the whole store, which is a fresh object on
  // every render: depending on that re-read every photo from IndexedDB each time
  // anything on the screen changed, and each read set state and caused another.
  useEffect(() => {
    let live = true
    void readPhoto(photoId).then((loaded) => {
      // The tile may have unmounted while the read was in flight.
      if (live) setPhoto(loaded)
    })
    return () => {
      live = false
    }
  }, [readPhoto, photoId])

  if (photo === null) return <span className="photo-tile" data-loading="true" />
  return <img className="photo-tile" src={photoSource(photo)} alt={alt} />
}

/**
 * Milestones, and the photos attached to them.
 *
 * A keepsake list rather than a developmental checklist, and the difference is the
 * whole design: no ages are attached to any suggestion, because the moment an app
 * says "first steps — 12 months" it has started telling a parent whether their child
 * is late. The screen says as much at the bottom.
 */
export function MilestonesScreen({ store, onBack }: MilestonesScreenProps) {
  const t = useTranslator()
  const { activeBaby, events } = store
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [pending, setPending] = useState<PreparedPhoto | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const milestones = useMemo(() => milestoneEvents(events), [events])
  const withPhotos = useMemo(() => photoMilestones(events), [events])
  const suggestions = useMemo(
    () => remainingSuggestions(events, MILESTONE_SUGGESTIONS),
    [events],
  )

  if (activeBaby === null) return null

  function reset() {
    setAdding(false)
    setName('')
    setPending(null)
    setPhotoError(null)
  }

  async function pick(file: File) {
    setPreparing(true)
    setPhotoError(null)
    try {
      // Downscaled and re-encoded here, before it is ever stored: see ui/photo.ts.
      setPending(await preparePhoto(file))
    } catch {
      setPhotoError(t.t('milestone.photoFailed'))
    } finally {
      setPreparing(false)
    }
  }

  async function save() {
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    // The photo is written first so the milestone can point at a row that exists.
    const photoId = pending === null ? null : await store.savePhoto(pending)
    await store.logMilestone({
      name: trimmed,
      photoId,
      note: '',
      startedAt: Date.now(),
    })
    reset()
    setToast(t.t('toast.milestoneSaved'))
    globalThis.setTimeout(() => setToast(null), 2200)
  }

  function ageAt(event: MilestoneEvent): string | null {
    return formatAge(t, describeAge(activeBaby?.birthDate ?? null, event.startedAt))
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('milestone.title')}</span>
          {milestones.length > 0 && (
            <span className="appbar-age">
              {t.plural('milestone.count', milestones.length)}
            </span>
          )}
        </div>
      </header>

      <main className="page">
        {withPhotos.length > 0 && (
          <section className="section">
            <RuleLabel>{t.t('milestone.journal')}</RuleLabel>
            <div className="photo-grid">
              {withPhotos.slice(0, 12).map((event) => (
                <PhotoTile
                  key={event.id}
                  readPhoto={store.readPhoto}
                  photoId={event.photoId as Id}
                  alt={event.name}
                />
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <RuleLabel>{t.t('milestone.title')}</RuleLabel>

          {milestones.length === 0 ? (
            <>
              <p className="empty">{t.t('milestone.empty')}</p>
              <p className="field-note">{t.t('milestone.emptyHint')}</p>
            </>
          ) : (
            <div className="milestones">
              {milestones.map((event) => (
                <div className="milestone" key={event.id}>
                  {event.photoId !== null && (
                    <PhotoTile
                      readPhoto={store.readPhoto}
                      photoId={event.photoId}
                      alt={event.name}
                    />
                  )}
                  <div className="milestone-body">
                    <span className="milestone-name">{event.name}</span>
                    <span className="milestone-when num">
                      {formatShortDate(t.locale, event.startedAt)}
                      {ageAt(event) !== null &&
                        ` · ${t.t('milestone.at', { age: ageAt(event) ?? '' })}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setAdding(true)}
          >
            {t.t('milestone.log')}
          </button>

          {/* What this is and is not, said where the list is read. */}
          <p className="field-note">{t.t('milestone.note')}</p>
        </section>
      </main>

      {adding && (
        <Sheet title={t.t('milestone.log')} onClose={reset}>
          {suggestions.length > 0 && (
            <div className="field">
              <span className="field-label" id="milestone-suggestions">
                {t.t('milestone.suggestions')}
              </span>
              {/* Suggestions already recorded drop off the list, so the chips stop
                  offering a first smile that was logged three months ago. */}
              <div className="tag-row" role="group" aria-labelledby="milestone-suggestions">
                {suggestions.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="tag"
                    aria-pressed={name === suggestion}
                    onClick={() => setName(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="milestone-name">
              {t.t('milestone.name')}
            </label>
            <input
              id="milestone-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.t('milestone.namePlaceholder')}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <span className="field-label">{t.t('milestone.photo')}</span>
            {pending !== null && (
              <img
                className="photo-preview"
                src={photoSource(pending)}
                alt={name === '' ? t.t('milestone.photo') : name}
              />
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file !== undefined) void pick(file)
              }}
            />
            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={() => fileInput.current?.click()}
                disabled={preparing}
              >
                {preparing
                  ? t.t('milestone.photoPending')
                  : pending === null
                    ? t.t('milestone.addPhoto')
                    : t.t('milestone.changePhoto')}
              </button>
              {pending !== null && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setPending(null)}
                >
                  <CloseIcon size={18} />
                  <span className="sr-only">{t.t('milestone.removePhoto')}</span>
                </button>
              )}
            </div>
            {photoError !== null && (
              <p className="banner" data-tone="error" role="alert">
                {photoError}
              </p>
            )}
            {/* Said before the photo is chosen, not after: a parent deciding whether
                to attach a picture of their child needs to know where it goes. */}
            <p className="field-note">{t.t('milestone.photoNote')}</p>
            {pending !== null && (
              <p className="field-note num">
                {t.t('milestone.storage', {
                  count: t.number(1),
                  size: `${Math.round(photoBytes(pending) / 1024)} kB`,
                })}
              </p>
            )}
          </div>

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => void save()}
            disabled={preparing || name.trim().length === 0}
          >
            {t.t('milestone.save')}
          </button>
        </Sheet>
      )}

      {toast !== null && (
        <div className="toast" role="status" aria-live="polite">
          <CheckIcon size={16} />
          <span>{toast}</span>
        </div>
      )}
    </>
  )
}
