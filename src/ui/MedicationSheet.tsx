import { useState } from 'react'
import { useTranslator } from '@/i18n/context'
import { Sheet } from './Sheet'

interface MedicationSheetProps {
  /** Names already logged, offered so a repeat dose needs no typing. */
  knownNames: readonly string[]
  onSave: (input: { name: string; dose: string }) => Promise<void>
  onClose: () => void
}

/**
 * Logging a dose.
 *
 * The dose is free text on purpose: 2.5 ml, 5 mg, one drop, half a tablet. A
 * structured amount and unit would be a precision the app does not have, and would
 * make the common case slower to type at the moment it is most needed.
 */
export function MedicationSheet({ knownNames, onSave, onClose }: MedicationSheetProps) {
  const t = useTranslator()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError(t.t('error.enterMedicationName'))
      return
    }
    setSaving(true)
    try {
      await onSave({ name: trimmed, dose: dose.trim() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('medication.title')} onClose={onClose}>
      {knownNames.length > 0 && (
        <div className="field">
          {/* Its own label, not the field's: two controls sharing one accessible
              name means a screen reader announces the same thing twice. */}
          <span className="field-label" id="medication-known-label">
            {t.t('medication.recent')}
          </span>
          <div className="chip-row" role="group" aria-labelledby="medication-known-label">
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
        <label className="field-label" htmlFor="medication-name">
          {t.t('medication.name')}
        </label>
        <input
          id="medication-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.t('medication.namePlaceholder')}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="medication-dose">
          {t.t('medication.dose')}
        </label>
        <input
          id="medication-dose"
          type="text"
          value={dose}
          onChange={(event) => setDose(event.target.value)}
          placeholder={t.t('medication.dosePlaceholder')}
          autoComplete="off"
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
        {t.t('medication.save')}
      </button>
    </Sheet>
  )
}
