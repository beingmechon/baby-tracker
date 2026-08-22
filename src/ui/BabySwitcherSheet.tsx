import { useState } from 'react'
import { describeAge, localDateKey } from '@/domain/time'
import type { Baby, Id, Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { formatAge } from '@/i18n/format'
import { Sheet } from './Sheet'
import { CheckIcon } from './icons'

interface BabySwitcherSheetProps {
  babies: readonly Baby[]
  activeBabyId: Id | null
  now: Timestamp
  onSwitch: (baby: Baby) => void
  onAdd: (input: { name: string; birthDate: string | null }) => Promise<void>
  onClose: () => void
}

/**
 * Switching between babies, and adding one.
 *
 * Both live in the same sheet because they are the same question — "who am I
 * logging for?" — and because a separate screen for two controls is a screen a
 * tired parent has to find. The add form is folded away until asked for, so the
 * common case is one tap on a name.
 */
export function BabySwitcherSheet({
  babies,
  activeBabyId,
  now,
  onSwitch,
  onAdd,
  onClose,
}: BabySwitcherSheetProps) {
  const t = useTranslator()
  const [adding, setAdding] = useState(babies.length === 0)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (saving) return
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError(t.t('error.nameRequired'))
      return
    }
    setSaving(true)
    try {
      await onAdd({ name: trimmed, birthDate: birthDate === '' ? null : birthDate })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('babies.title')} onClose={onClose}>
      <div className="baby-list">
        {babies.map((baby) => {
          const age = formatAge(t, describeAge(baby.birthDate, now))
          const isActive = baby.id === activeBabyId
          return (
            <button
              key={baby.id}
              type="button"
              className="baby-row"
              aria-pressed={isActive}
              onClick={() => onSwitch(baby)}
            >
              <span className="baby-identity">
                <span className="baby-name">{baby.name}</span>
                {age !== null && <span className="baby-age">{age}</span>}
              </span>
              {isActive && (
                <span className="baby-active">
                  <CheckIcon size={16} />
                  <span className="baby-active-label">{t.t('babies.openNow')}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {adding ? (
        <>
          <div className="field">
            <label className="field-label" htmlFor="new-baby-name">
              {t.t('babies.name')}
            </label>
            <input
              id="new-baby-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.t('babies.namePlaceholder')}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="new-baby-birthdate">
              {t.t('babies.birthDate')}
            </label>
            <input
              id="new-baby-birthdate"
              type="date"
              value={birthDate}
              max={localDateKey(now)}
              onChange={(event) => setBirthDate(event.target.value)}
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
            onClick={() => void add()}
            disabled={saving}
          >
            {t.t(saving ? 'babies.saving' : 'babies.save')}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="button"
          data-variant="secondary"
          onClick={() => setAdding(true)}
        >
          {t.t('babies.add')}
        </button>
      )}
    </Sheet>
  )
}
