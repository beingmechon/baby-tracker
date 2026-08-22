import { useState } from 'react'
import type { SymptomImpression } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { symptomImpressionName } from '@/i18n/format'
import { Sheet } from './Sheet'

interface SymptomSheetProps {
  /** Names already logged, so following up on yesterday's cough needs no typing. */
  knownNames: readonly string[]
  onSave: (input: {
    name: string
    impression: SymptomImpression
    note: string
  }) => Promise<void>
  onClose: () => void
}

const IMPRESSIONS: readonly SymptomImpression[] = ['mild', 'moderate', 'severe']

/**
 * Logging something you noticed.
 *
 * The name is free text with past entries offered as chips. A fixed list would be
 * either incomplete or a set of clinical categories, and this app is in no position
 * to offer either — "whatever you would say out loud" is the right vocabulary for a
 * diary a parent keeps.
 *
 * The impression is the parent's own word, and the sheet says so underneath. The app
 * never reads anything into it: nothing is triaged, ranked or flagged from this
 * value, and the only place it goes is back onto the screen and onto paper.
 */
export function SymptomSheet({ knownNames, onSave, onClose }: SymptomSheetProps) {
  const t = useTranslator()
  const [name, setName] = useState('')
  const [impression, setImpression] = useState<SymptomImpression>('mild')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError(t.t('error.enterSymptom'))
      return
    }
    setSaving(true)
    try {
      await onSave({ name: trimmed, impression, note: note.trim() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('symptom.title')} onClose={onClose}>
      {knownNames.length > 0 && (
        <div className="field">
          <span className="field-label" id="symptom-known-label">
            {t.t('symptom.recent')}
          </span>
          <div className="chip-row" role="group" aria-labelledby="symptom-known-label">
            {knownNames.slice(0, 3).map((known) => (
              <button
                key={known}
                type="button"
                className="chip"
                aria-pressed={name === known}
                onClick={() => setName(known)}
              >
                {known}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="symptom-name">
          {t.t('symptom.name')}
        </label>
        <input
          id="symptom-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.t('symptom.namePlaceholder')}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <span className="field-label" id="symptom-impression-label">
          {t.t('symptom.impression')}
        </span>
        <div
          className="segmented"
          role="group"
          aria-labelledby="symptom-impression-label"
        >
          {IMPRESSIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={impression === option}
              onClick={() => setImpression(option)}
            >
              {symptomImpressionName(t, option)}
            </button>
          ))}
        </div>
        {/* Said at the point of entry, not buried on a help screen. */}
        <p className="field-note">{t.t('symptom.impressionNote')}</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="symptom-note">
          {t.t('symptom.note')}
        </label>
        <textarea
          id="symptom-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.t('symptom.notePlaceholder')}
        />
      </div>

      {error !== null && (
        <p className="banner" data-tone="error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="button"
        data-variant="primary"
        onClick={() => void save()}
        disabled={saving}
      >
        {t.t('symptom.save')}
      </button>
    </Sheet>
  )
}
